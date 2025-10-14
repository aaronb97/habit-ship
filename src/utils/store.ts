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

function randomColorInt(): number {
  // Generate a pastel color
  const base = Math.floor(Math.random() * 0x7f7f7f);
  const pastel = base + 0x7f7f7f;
  return pastel;
}

export function getPlanetPosition(planetName: string): Coordinates {
  const planet = cBodies.find((p) => p.name === planetName);
  if (!planet) throw new Error(`Planet ${planetName} not found`);

  return planet.getPosition();
}

// Distance awarded per habit completion based on level
function getHabitDistancePerCompletion(level: number): number {
  // 1,000,000 km base, scaled by 1.2^(level - 1)
  const L = Math.max(1, Math.floor(level));
  return 1_000_000 * Math.pow(1.2, L - 1);
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
  timeOffset: number;
  // Render/debug toggles
  showTrails: boolean;
  showTextures: boolean;
  logFPS: boolean;

  // Rocket appearance
  rocketColor: number;

  // Actions
  setIsSetupFinished: (value: boolean) => void;
  setDestination: (planetName: string) => void;
  warpTo: (planetName: string) => void;
  // Mark that the user has visually seen the latest travel progress; sync prev->curr
  syncTravelVisuals: () => void;
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
  setShowTrails: (value: boolean) => void;
  setShowTextures: (value: boolean) => void;
  setLogFPS: (value: boolean) => void;

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
  timeOffset: 0,
  showTrails: true,
  showTextures: true,
  logFPS: false,
  rocketColor: randomColorInt(),
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
          // Initialize travel metrics toward target
          const startPos = getPlanetPosition(
            state.userPosition.currentLocation,
          );
          const targetPos = getPlanetPosition(planetName);
          const centerDistance = calculateDistance(startPos, targetPos);
          const startBody = cBodies.find(
            (b) => b.name === state.userPosition.currentLocation,
          );
          const targetBody = cBodies.find((b) => b.name === planetName);
          const radiusBuffer =
            (startBody?.radiusKm ?? 0) + (targetBody?.radiusKm ?? 0);
          state.userPosition.initialDistance = Math.max(
            0,
            centerDistance - radiusBuffer,
          );
          state.userPosition.distanceTraveled = 0;
          state.userPosition.previousDistanceTraveled = 0;
          state.userPosition.launchTime = undefined;
          state.lastUpdateTime = undefined;
        });
      },
      warpTo: (planetName) => {
        set((state) => {
          // Instantly move to the specified planet and clear any travel state
          state.userPosition.currentLocation = planetName;
          state.userPosition.target = undefined;
          state.userPosition.launchTime = undefined;
          state.userPosition.initialDistance = undefined;
          state.userPosition.distanceTraveled = undefined;
          state.userPosition.previousDistanceTraveled = undefined;
          state.lastUpdateTime = undefined;
        });
      },
      setSwipedHabit: (habitId) => set({ swipedHabitId: habitId }),
      resetAllSwipes: () => set({ swipedHabitId: undefined }),
      setShowTrails: (value) => set({ showTrails: value }),
      setShowTextures: (value) => set({ showTextures: value }),
      setLogFPS: (value) => set({ logFPS: value }),
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
            target: {
              name: 'The Moon',
              position: moon.getPosition(),
            },
            initialDistance: Math.max(
              0,
              calculateDistance(
                getPlanetPosition('Earth'),
                moon.getPosition(),
              ) -
                (earth.radiusKm + moon.radiusKm),
            ),
            distanceTraveled: 0,
            previousDistanceTraveled: 0,
          },
          idCount: 1,
        });
      },
      clearData: () => set(initialData),

      // --- Complex/Async Actions ---

      /**
       * Completes a habit, awards XP, and advances travel by a fixed distance based on level.
       */
      completeHabit: async (habitId) => {
        get().addXP(XP_REWARDS.HABIT_COMPLETION, 'habit_completion');

        set((state) => {
          const habitToComplete = state.habits.find((h) => h.id === habitId);
          if (habitToComplete) {
            habitToComplete.completions.push(getCurrentDate().toISOString());
          }
          const target = state.userPosition.target;
          if (
            target &&
            typeof state.userPosition.initialDistance === 'number'
          ) {
            // First movement establishes launch time
            if (!state.userPosition.launchTime) {
              state.userPosition.launchTime = getCurrentDate().toISOString();
            }

            const level = state.userLevel.level;
            const moveKm = getHabitDistancePerCompletion(level);
            const prev = state.userPosition.distanceTraveled ?? 0;
            const next = Math.min(
              state.userPosition.initialDistance,
              prev + moveKm,
            );

            // Record update time; do NOT update previousDistanceTraveled here.
            state.userPosition.distanceTraveled = next;
            state.lastUpdateTime = getCurrentTime();

            // Check arrival
            if (next >= (state.userPosition.initialDistance ?? 0)) {
              const destinationName = target.name;
              const isNewPlanet =
                !state.completedPlanets.includes(destinationName);

              state.userPosition.currentLocation = destinationName;
              state.userPosition.target = undefined;
              state.userPosition.launchTime = undefined;
              state.userPosition.initialDistance = undefined;
              state.userPosition.distanceTraveled = undefined;
              state.userPosition.previousDistanceTraveled = undefined;
              state.lastUpdateTime = undefined;

              if (isNewPlanet) {
                state.completedPlanets.push(destinationName);
              }

              if (isNewPlanet) {
                // Award XP for planet completion
                get().addXP(XP_REWARDS.PLANET_COMPLETION, 'planet_completion');
              }
            }
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
       * Sync visual travel progress after user has seen the animation.
       * This sets previousDistanceTraveled = distanceTraveled.
       */
      syncTravelVisuals: () => {
        set((state) => {
          if (
            state.userPosition.distanceTraveled !== undefined &&
            state.userPosition.target
          ) {
            state.userPosition.previousDistanceTraveled =
              state.userPosition.distanceTraveled;
          }

          console.log('Synced travel visuals');
        });
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
      version: 2,
      migrate: (persistedState, _version) => {
        const s = (persistedState || {}) as Partial<Store>;
        if (s.rocketColor === undefined) {
          s.rocketColor = randomColorInt();
        }
        return s as Store;
      },
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
  ).getPosition();
}

export function useCurrentPosition() {
  return useStore(
    useShallow((state) => getCurrentPosition(state.userPosition)),
  );
}

export const useIsSetupFinished = () =>
  useStore((state) => state.isSetupFinished);

export const useUserLevel = () => useStore((state) => state.userLevel);

export function isTraveling(store: Store) {
  return (
    !!store.userPosition.target &&
    (store.userPosition.distanceTraveled ?? 0) > 0
  );
}

export function useIsTraveling() {
  return useStore((state) => isTraveling(state));
}
