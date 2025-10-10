import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { planets } from '../planets';
import {
  Coordinates,
  UserLevel,
  UserPosition,
  XPGain,
  XP_REWARDS,
  calculateLevel,
  getCurrentLevelXP,
} from '../types';
import * as Notifications from 'expo-notifications';
import { useCallback } from 'react';
import { schedulePushNotification } from './schedulePushNotification';
import { Hour, Minute, minutesToHours } from './units';

export type HabitId = string & { __habitId: true };

export type Habit = {
  id: HabitId;
  title: string;
  description?: string;
  completions: string[];

  /**
   * Timer length in minutes
   */
  timerLength?: Minute;
};

// Helper function to calculate distance between two coordinates
export function calculateDistance(a: Coordinates, b: Coordinates): number {
  return Math.sqrt(
    Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2) + Math.pow(b.z - a.z, 2),
  );
}

// Helper function to get planet position for a given date
export function getPlanetPosition(
  planetName: string,
  date = new Date().toISOString().split('T')[0],
): Coordinates {
  const planet = planets.find((p) => p.name === planetName);
  if (!planet) throw new Error(`Planet ${planetName} not found`);

  // Try to get position for the given date, or use first available date
  const position =
    planet.dailyPositions[date] ??
    planet.dailyPositions[Object.keys(planet.dailyPositions).at(-1) as string];

  const [x, y, z] = position;
  return { x, y, z };
}

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

  setIsSetupFinished: (value: boolean) => void;
  setDestination: (planetName: string) => void;
  completePlanet: (planetName: string) => void;
  updateTravelPosition: () => void;

  addHabit: (habit: {
    title: string;
    description?: string;
    timerLength?: Minute;
  }) => void;

  editHabit: (
    habitId: HabitId,
    editedHabit: Partial<Omit<Habit, 'id'>>,
  ) => void;

  completeHabit: (
    habitId: HabitId,
    nextSpeed: number,
    boostType: 'LAUNCH' | 'BOOST',
  ) => void;

  removeHabit: (habitId: HabitId) => void;

  startTimer: (habitId: HabitId, timerNotificationId: string) => void;

  cancelTimer: () => void;

  setSwipedHabit: (habitId?: HabitId) => void;

  resetAllSwipes: () => void;

  addXP: (
    amount: number,
    source: 'habit_completion' | 'planet_completion',
  ) => void;

  clearData: () => void;
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
} satisfies Partial<Store>;

export const useStore = create<Store>()(
  persist(
    immer((set) => ({
      ...initialData,

      setIsSetupFinished: (value: boolean) => {
        set((state) => {
          state.isSetupFinished = value;
        });
      },

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

      completeHabit: (
        habitId: HabitId,
        nextSpeed: number,
        boostType: 'LAUNCH' | 'BOOST',
      ) => {
        set((state) => {
          const habitToComplete = state.habits.find((h) => h.id === habitId);
          if (habitToComplete) {
            habitToComplete.completions.push(new Date().toISOString());
          }

          // Award XP for habit completion
          const xpGain: XPGain = {
            amount: XP_REWARDS.HABIT_COMPLETION,
            source: 'habit_completion',
            timestamp: new Date().toISOString(),
          };

          state.xpHistory.push(xpGain);
          state.userLevel.totalXP += xpGain.amount;
          state.userLevel.level = calculateLevel(state.userLevel.totalXP);
          state.userLevel.currentXP = getCurrentLevelXP(
            state.userLevel.totalXP,
          );

          state.userPosition.speed = nextSpeed;

          // Launch/speed mechanics
          if (boostType === 'LAUNCH') {
            if (state.userPosition.target) {
              state.userPosition.launchTime = new Date().toISOString();
              state.lastUpdateTime = Date.now();

              // Calculate initial distance
              const currentPos = getCurrentPosition(state.userPosition);
              const targetPos = state.userPosition.target.position;

              state.userPosition.initialDistance = calculateDistance(
                currentPos,
                targetPos,
              );

              state.userPosition.currentCoordinates = currentPos;
            }
          }
        });
      },

      completePlanet: (planetName: string) => {
        set((state) => {
          if (state.completedPlanets.includes(planetName)) {
            return;
          }

          state.completedPlanets.push(planetName);

          // Award XP for planet completion
          const xpGain: XPGain = {
            amount: XP_REWARDS.PLANET_COMPLETION,
            source: 'planet_completion',
            timestamp: new Date().toISOString(),
          };

          state.xpHistory.push(xpGain);
          state.userLevel.totalXP += xpGain.amount;
          state.userLevel.level = calculateLevel(state.userLevel.totalXP);
          state.userLevel.currentXP = getCurrentLevelXP(
            state.userLevel.totalXP,
          );
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

      setDestination: (planetName: string) => {
        set((state) => {
          state.userPosition.target = {
            name: planetName,
            position: getPlanetPosition(planetName),
          };

          state.userPosition.speed = 0; // Reset speed when selecting new destination
        });
      },

      updateTravelPosition: () => {
        set((state) => {
          if (
            !state.userPosition.target ||
            !state.userPosition.launchTime ||
            !state.userPosition.currentCoordinates
          ) {
            return;
          }

          // Calculate time elapsed since last update (in hours)
          const now = Date.now();
          const lastUpdate = state.lastUpdateTime || now;
          const millisecondsElapsed = now - lastUpdate;
          const hoursElapsed = millisecondsElapsed / 3600000; // 1 hour = 3,600,000 ms

          // Calculate distance traveled since last update (speed in km/h * hours)
          const distanceTraveledThisUpdate =
            state.userPosition.speed * hoursElapsed;

          // Get target position
          const targetPos = state.userPosition.target.position;

          // Calculate current distance to target
          const currentPos = state.userPosition.currentCoordinates;
          const distanceRemaining = calculateDistance(currentPos, targetPos);

          if (distanceTraveledThisUpdate >= distanceRemaining) {
            // Arrived at destination
            state.userPosition.currentLocation = state.userPosition.target.name;

            state.userPosition.currentCoordinates = undefined;
            state.userPosition.target = undefined;
            state.userPosition.speed = 0;
            state.userPosition.launchTime = undefined;
            state.userPosition.initialDistance = undefined;
            state.lastUpdateTime = undefined;

            // Complete planet
            if (state.userPosition.currentLocation) {
              state.completePlanet(state.userPosition.currentLocation);
            }
          } else {
            // Update current position incrementally
            const dx = targetPos.x - currentPos.x;
            const dy = targetPos.y - currentPos.y;
            const dz = targetPos.z - currentPos.z;
            const totalDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const progress = distanceTraveledThisUpdate / totalDistance;

            state.userPosition.currentCoordinates = {
              x: currentPos.x + dx * progress,
              y: currentPos.y + dy * progress,
              z: currentPos.z + dz * progress,
            };

            // Update last update time
            state.lastUpdateTime = now;
          }
        });
      },

      startTimer: (habitId: HabitId, timerNotificationId: string) => {
        set((state) => {
          state.activeTimer = {
            habitId,
            startTime: new Date().toISOString(),
            timerNotificationId,
          };
        });
      },

      cancelTimer: () => {
        set((state) => {
          state.activeTimer = undefined;
        });
      },

      setSwipedHabit: (habitId?: HabitId) => {
        set((state) => {
          state.swipedHabitId = habitId;
        });
      },

      resetAllSwipes: () => {
        set((state) => {
          state.swipedHabitId = undefined;
        });
      },

      addXP: (
        amount: number,
        source: 'habit_completion' | 'planet_completion',
      ) => {
        set((state) => {
          const xpGain: XPGain = {
            amount,
            source,
            timestamp: new Date().toISOString(),
          };

          state.xpHistory.push(xpGain);
          state.userLevel.totalXP += amount;
          state.userLevel.level = calculateLevel(state.userLevel.totalXP);
          state.userLevel.currentXP = getCurrentLevelXP(
            state.userLevel.totalXP,
          );
        });
      },

      clearData: () => {
        set((state) => {
          Object.assign(state, initialData);
        });
      },
    })),
    {
      name: 'space-explorer-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/**
 * Hook that calculates the next speed, clears existing land notification, sets next notification using new speed, and completes habit
 */
export function useCompleteHabit() {
  const {
    userPosition,
    planetLandedNotificationId,
    completeHabit: _completeHabit,
  } = useStore();

  const completeHabit = useCallback(
    async (habitId: HabitId) => {
      const isLaunching = userPosition.speed === 0;
      const nextSpeed = isLaunching ? 50000 : userPosition.speed * 1.2;
      const boostType = isLaunching ? ('LAUNCH' as const) : ('BOOST' as const);

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

      try {
        const id = await schedulePushNotification({
          title: `You have landed on ${userPosition.target!.name}!`,
          hours: timeRemaining,
        });

        useStore.setState({ planetLandedNotificationId: id });
      } catch (e) {
        console.warn('Failed to schedule notification', e);
      }

      _completeHabit(habitId, nextSpeed, boostType);
    },
    [userPosition, planetLandedNotificationId, _completeHabit],
  );

  return completeHabit;
}

export function useStartTimer() {
  const { startTimer, habits, activeTimer } = useStore();

  const fn = useCallback(
    async (habitId: HabitId) => {
      if (activeTimer) {
        Alert.alert(
          'Timer Already Active',
          'Another timer is already running. Please stop it before starting a new one.',
        );

        return;
      }

      const habit = habits.find((h) => h.id === habitId);

      console.log(habit?.timerLength);

      if (!habit || !habit.timerLength) {
        Alert.alert('Timer Error', 'Habit not found or timer length not set');
        return;
      }

      const timerId = await schedulePushNotification({
        title: `Your timer for ${habit.title} is up!`,
        hours: minutesToHours(habit.timerLength),
      });

      startTimer(habitId, timerId);
    },
    [startTimer, habits, activeTimer],
  );

  return fn;
}

/**
 * User pressed cancel
 */
export function useCancelTimer() {
  const { activeTimer } = useStore();

  const fn = useCallback(async () => {
    const timerId = activeTimer?.timerNotificationId;

    if (timerId) {
      await Notifications.cancelScheduledNotificationAsync(timerId);
    }

    useStore.setState({ activeTimer: undefined });
  }, [activeTimer?.timerNotificationId]);

  return fn;
}

export function useExpireTimer() {
  const fn = useCallback(() => {
    useStore.setState({ activeTimer: undefined });
  }, []);

  return fn;
}

export const useIsSetupFinished = () => useStore().isSetupFinished;
export const useIsSetupInProgress = () => !useStore().isSetupFinished;
export const useUserLevel = () => useStore().userLevel;

function getCurrentPosition(position: UserPosition) {
  return (
    position.currentCoordinates ??
    getPlanetPosition(position.currentLocation ?? 'Earth')
  );
}

function getTimeRemaining(
  position: UserPosition,
  speed: number = position.speed,
) {
  if (!position.target) {
    return 0 as Hour;
  }

  const timeRemaining =
    calculateDistance(getCurrentPosition(position), position.target.position) /
    speed;

  return timeRemaining as Hour;
}

export function useTimeRemaining() {
  const { userPosition } = useStore();

  return getTimeRemaining(userPosition);
}

export function useIsTraveling() {
  const { userPosition } = useStore();

  return userPosition.target !== undefined && userPosition.speed > 0;
}
