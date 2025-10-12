import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { earth, moon, cBodies } from '../planets';
import { schedulePushNotification } from './schedulePushNotification';
import { getCurrentTime, getCurrentDate } from './time';
import {
  Coordinates,
  UserLevel,
  UserPosition,
  XPGain,
  XP_REWARDS,
  calculateLevel,
  getCurrentLevelXP,
} from '../types';
import { useShallow } from 'zustand/shallow';

// =================================================================
// TYPES
// =================================================================

export type HabitId = string & { __habitId: true };

export type Habit = {
  id: HabitId;
  title: string;
  description?: string;
  completions: string[];
  timerLength?: number; // in seconds
};

// =================================================================
// HELPER FUNCTIONS
// =================================================================

export function calculateDistance(a: Coordinates, b: Coordinates): number {
  return Math.sqrt(
    Math.pow(b[0] - a[0], 2) +
      Math.pow(b[1] - a[1], 2) +
      Math.pow(b[2] - a[2], 2),
  );
}

export function getPlanetPosition(planetName: string): Coordinates {
  const planet = cBodies.find((p) => p.name === planetName);
  if (!planet) throw new Error(`Planet ${planetName} not found`);

  return planet.getCurrentPosition();
}

// =================================================================
// STORE DEFINITION
// =================================================================

type Store = {
  isSetupFinished: boolean;
  habits: Habit[];
  userPosition: UserPosition;
  completedPlanets: string[];
  userLevel: UserLevel;
  xpHistory: XPGain[];
  idCount: number;
  activeTimer?: {
    habitId: HabitId;
    startTime: string;
    timerNotificationId: string;
  };
  swipedHabitId?: HabitId;
  lastUpdateTime?: number;
  planetLandedNotificationId?: string;
  timeOffset: number;

  // Actions
  setIsSetupFinished: (value: boolean) => void;
  setDestination: (planetName: string) => void;
  warpTo: (planetName: string) => void;
  updateTravelPosition: () => void;
  addHabit: (habit: {
    title: string;
    description?: string;
    timerLength?: number; // in seconds
  }) => void;

  editHabit: (
    habitId: HabitId,
    editedHabit: Partial<Omit<Habit, 'id'>>,
  ) => void;

  removeHabit: (habitId: HabitId) => void;
  setSwipedHabit: (habitId?: HabitId) => void;
  resetAllSwipes: () => void;
  addXP: (
    amount: number,
    source: 'habit_completion' | 'planet_completion',
  ) => void;
  quickReset: () => void;
  clearData: () => void;

  completeHabit: (habitId: HabitId) => Promise<void>;
  startTimer: (habitId: HabitId) => Promise<boolean>; // Returns true on success, false on failure
  cancelTimer: () => Promise<void>;
  expireTimer: () => void; // Sync action is sufficient here
};

const initialData = {
  isSetupFinished: false,
  habits: [],
  userPosition: {
    currentLocation: 'Earth',
    speed: 0,
  },
  completedPlanets: ['Earth'],
  userLevel: {
    level: 1,
    currentXP: 0,
    totalXP: 0,
  },
  xpHistory: [],
  idCount: 0,
  swipedHabitId: undefined,
  activeTimer: undefined,
  lastUpdateTime: undefined,
  planetLandedNotificationId: undefined,
  timeOffset: 0,
} satisfies Partial<Store>;

export const useStore = create<Store>()(
  persist(
    immer((set, get) => ({
      ...initialData,

      setIsSetupFinished: (value) => set({ isSetupFinished: value }),
      addHabit: (habit) => {
        set((state) => {
          state.habits.push({
            ...habit,
            timerLength: habit.timerLength || undefined,
            id: state.idCount.toString() as HabitId,
            completions: [],
          });

          state.idCount++;
        });
      },

      editHabit: (habitId, editedHabit) => {
        set((state) => {
          const habitToEdit = state.habits.find((h) => h.id === habitId);
          if (habitToEdit) {
            Object.assign(habitToEdit, editedHabit);
          }
        });
      },

      removeHabit: (habitId) => {
        set((state) => {
          const habitIndex = state.habits.findIndex((h) => h.id === habitId);
          if (habitIndex !== -1) {
            state.habits.splice(habitIndex, 1);
          }
        });
      },

      setDestination: (planetName) => {
        set((state) => {
          state.userPosition.target = {
            name: planetName,
            position: getPlanetPosition(planetName),
          };

          state.userPosition.speed = 0;
        });
      },
      warpTo: (planetName) => {
        const { planetLandedNotificationId } = get();
        if (planetLandedNotificationId) {
          Notifications.cancelScheduledNotificationAsync(
            planetLandedNotificationId,
          ).catch((e) => console.warn('Failed to cancel notification', e));
        }

        set((state) => {
          // Instantly move to the specified planet and clear any travel state
          state.userPosition.currentLocation = planetName;
          state.userPosition.target = undefined;
          state.userPosition.speed = 0;
          state.userPosition.launchTime = undefined;
          state.userPosition.initialDistance = undefined;
          state.userPosition.distanceTraveled = undefined;
          state.lastUpdateTime = undefined;
          state.planetLandedNotificationId = undefined;
        });
      },
      setSwipedHabit: (habitId) => set({ swipedHabitId: habitId }),
      resetAllSwipes: () => set({ swipedHabitId: undefined }),
      quickReset: () => {
        set({
          ...initialData,
          isSetupFinished: true,
          habits: [
            {
              id: '0' as HabitId,
              title: 'Morning Meditation',
              description: 'Sample description',
              completions: [],
              timerLength: 600,
            },
          ],
          userPosition: {
            currentLocation: 'Earth',
            speed: 0,
            target: {
              name: 'The Moon',
              position: moon.getCurrentPosition(),
            },
          },
          idCount: 1,
        });
      },
      clearData: () => set(initialData),

      // --- Complex/Async Actions ---

      /**
       * Completes a habit, awards XP, updates travel speed, and reschedules notifications.
       */
      completeHabit: async (habitId) => {
        const { userPosition, planetLandedNotificationId } = get();
        const isLaunching = userPosition.speed === 0;
        const nextSpeed = isLaunching ? 50000 : userPosition.speed * 1.2;
        const boostType = isLaunching
          ? ('LAUNCH' as const)
          : ('BOOST' as const);

        if (planetLandedNotificationId) {
          try {
            await Notifications.cancelScheduledNotificationAsync(
              planetLandedNotificationId,
            );
          } catch (e) {
            console.warn('Failed to cancel notification', e);
          }
        }

        const timeRemaining = getTimeRemaining(userPosition, nextSpeed);
        let newNotificationId: string | undefined;
        if (userPosition.target) {
          try {
            newNotificationId = await schedulePushNotification({
              title: `You have landed on ${userPosition.target.name}!`,
              seconds: timeRemaining,
            });
          } catch (e) {
            console.warn('Failed to schedule notification', e);
          }
        }

        get().addXP(XP_REWARDS.HABIT_COMPLETION, 'habit_completion');

        set((state) => {
          const habitToComplete = state.habits.find((h) => h.id === habitId);
          if (habitToComplete) {
            habitToComplete.completions.push(getCurrentDate().toISOString());
          }

          state.userPosition.speed = nextSpeed;

          if (newNotificationId) {
            state.planetLandedNotificationId = newNotificationId;
          }

          if (boostType === 'LAUNCH' && state.userPosition.target) {
            state.userPosition.launchTime = getCurrentDate().toISOString();
            state.lastUpdateTime = getCurrentTime();

            const startPos = getPlanetPosition(
              state.userPosition.currentLocation,
            );

            const targetPos = getPlanetPosition(state.userPosition.target.name);

            state.userPosition.initialDistance = calculateDistance(
              startPos,
              targetPos,
            );

            state.userPosition.distanceTraveled = 0;
          }
        });
      },

      /**
       * Starts a timer for a specific habit if one isn't already running.
       * @returns `true` if the timer was started successfully, `false` otherwise.
       */
      startTimer: async (habitId) => {
        const { activeTimer, habits } = get();

        if (activeTimer) {
          console.warn(
            'Timer Already Active: Another timer is already running.',
          );

          return false; // Indicate failure
        }

        const habit = habits.find((h) => h.id === habitId);
        if (!habit || !habit.timerLength) {
          console.error('Timer Error: Habit not found or timer length not set');
          return false; // Indicate failure
        }

        try {
          const timerId = await schedulePushNotification({
            title: `Your timer for ${habit.title} is up!`,
            seconds: habit.timerLength,
          });

          set({
            activeTimer: {
              habitId,
              startTime: getCurrentDate().toISOString(),
              timerNotificationId: timerId,
            },
          });

          return true; // Indicate success
        } catch (e) {
          console.error('Failed to schedule timer notification', e);
          return false; // Indicate failure
        }
      },

      /**
       * Cancels the currently active timer and its scheduled notification.
       */
      cancelTimer: async () => {
        const { activeTimer } = get();
        if (activeTimer?.timerNotificationId) {
          try {
            await Notifications.cancelScheduledNotificationAsync(
              activeTimer.timerNotificationId,
            );
          } catch (e) {
            console.warn('Failed to cancel timer notification', e);
          }
        }

        set({ activeTimer: undefined });
      },

      /**
       * Clears the active timer from state without trying to cancel the notification.
       * (Used after a notification has already fired).
       */
      expireTimer: () => {
        set({ activeTimer: undefined });
      },

      /**
       * Updates the user's position during travel. If destination is reached,
       * completes the planet and resets travel state.
       */
      updateTravelPosition: () => {
        const {
          lastUpdateTime,
          userPosition: {
            target,
            launchTime,
            speed,
            initialDistance,
            distanceTraveled,
          },
          completedPlanets,
        } = get();

        if (!target || !launchTime || initialDistance === undefined) return;

        const now = getCurrentTime();
        const lastUpdate = lastUpdateTime || now;
        const hoursElapsed = (now - lastUpdate) / 3600000;
        const deltaDistance = speed * hoursElapsed;
        const newDistanceTraveled = Math.min(
          initialDistance,
          (distanceTraveled ?? 0) + deltaDistance,
        );

        if (newDistanceTraveled >= initialDistance) {
          // Arrived
          const destinationName = target.name;
          const isNewPlanet = !completedPlanets.includes(destinationName);

          set((state) => {
            state.userPosition.currentLocation = destinationName;
            state.userPosition.target = undefined;
            state.userPosition.speed = 0;
            state.userPosition.launchTime = undefined;
            state.userPosition.initialDistance = undefined;
            state.userPosition.distanceTraveled = undefined;
            state.lastUpdateTime = undefined;

            // Complete the planet directly
            if (isNewPlanet) {
              state.completedPlanets.push(destinationName);
            }
          });

          if (isNewPlanet) {
            get().addXP(XP_REWARDS.PLANET_COMPLETION, 'planet_completion');
          }
        } else {
          // Still traveling
          set((state) => {
            state.userPosition.distanceTraveled = newDistanceTraveled;
            state.lastUpdateTime = now;
          });
        }
      },

      /**
       * Adds a specified amount of XP to the user's total.
       */
      addXP: (amount, source) => {
        set((state) => {
          state.xpHistory.push({
            amount,
            source,
            timestamp: getCurrentDate().toISOString(),
          });

          state.userLevel.totalXP += amount;
          state.userLevel.level = calculateLevel(state.userLevel.totalXP);
          state.userLevel.currentXP = getCurrentLevelXP(
            state.userLevel.totalXP,
          );
        });
      },
    })),
    {
      name: 'space-explorer-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// =================================================================
// SELECTOR HOOKS (for reading state)
// =================================================================

function getCurrentPosition(position: UserPosition) {
  // If in-flight with distance tracking, interpolate between the
  // CURRENT positions of the start and target bodies using traveled ratio.
  if (
    position.target &&
    position.initialDistance !== undefined &&
    position.distanceTraveled !== undefined
  ) {
    const start = getPlanetPosition(position.currentLocation);
    const target = getPlanetPosition(position.target.name);
    const denom = position.initialDistance === 0 ? 1 : position.initialDistance;
    const t = Math.min(1, Math.max(0, position.distanceTraveled / denom));

    return [
      start[0] + (target[0] - start[0]) * t,
      start[1] + (target[1] - start[1]) * t,
      start[2] + (target[2] - start[2]) * t,
    ] as Coordinates;
  }

  // Otherwise, use the current body's true position
  return (
    cBodies.find((p) => p.name === position.currentLocation) ?? earth
  ).getCurrentPosition();
}

export function useCurrentPosition() {
  return useStore(
    useShallow((state) => getCurrentPosition(state.userPosition)),
  );
}

function getTimeRemaining(
  position: UserPosition,
  speed: number = position.speed,
): number {
  if (!position.target || speed === 0) {
    return 0;
  }

  // Use distance tracking only
  if (position.initialDistance === undefined) return 0;
  const traveled = position.distanceTraveled ?? 0;
  const remaining = Math.max(0, position.initialDistance - traveled);
  return (remaining / speed) * 3600;
}

export const useIsSetupFinished = () =>
  useStore((state) => state.isSetupFinished);
export const useUserLevel = () => useStore((state) => state.userLevel);
export const useTimeRemaining = () => {
  const userPosition = useStore((state) => state.userPosition);
  return getTimeRemaining(userPosition);
};

export const useIsTraveling = () =>
  useStore(
    (state) => !!state.userPosition.target && state.userPosition.speed > 0,
  );
