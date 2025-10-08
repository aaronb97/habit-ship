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

export type HabitId = string & { __habitId: true };

export type Habit = {
  id: HabitId;
  title: string;
  description?: string;
  completions: string[];
  timerLength?: number;
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
  };
  swipedHabitId?: HabitId;
  lastUpdateTime?: number;

  notificationId?: string;

  setIsSetupFinished: (value: boolean) => void;
  setDestination: (planetName: string) => void;
  completePlanet: (planetName: string) => void;
  updateTravelPosition: () => void;

  addHabit: (habit: {
    title: string;
    description?: string;
    timerLength?: number;
  }) => void;

  editHabit: (
    habitId: HabitId,
    editedHabit: Partial<Omit<Habit, 'id'>>,
  ) => void;

  completeHabit: (habitId: HabitId) => void;

  removeHabit: (habitId: HabitId) => void;

  startTimer: (habitId: HabitId) => void;

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

      completeHabit: (habitId: HabitId) => {
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

          // Launch/speed mechanics
          if (state.userPosition.speed === 0) {
            // Launch with initial speed of 50,000 km/h
            state.userPosition.speed = 50000;

            if (state.userPosition.target) {
              state.userPosition.launchTime = new Date().toISOString();
              state.lastUpdateTime = Date.now();

              // Calculate initial distance
              const currentPos =
                state.userPosition.currentCoordinates ||
                getPlanetPosition(
                  state.userPosition.currentLocation || 'Earth',
                );

              const targetPos = state.userPosition.target.position;

              state.userPosition.initialDistance = calculateDistance(
                currentPos,
                targetPos,
              );

              state.userPosition.currentCoordinates = currentPos;
            }
          } else if (state.userPosition.target) {
            if (state.userPosition.speed === 0) {
              state.userPosition.speed = 50000;
              return;
            }

            // Increase speed by 1.2x
            state.userPosition.speed *= 1.2;
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

      startTimer: (habitId: HabitId) => {
        set((state) => {
          if (state.activeTimer) {
            Alert.alert(
              'Timer Already Active',
              'Another timer is already running. Please stop it before starting a new one.',
            );

            return;
          }

          state.activeTimer = {
            habitId,
            startTime: new Date().toISOString(),
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

export const useIsSetupFinished = () => useStore().isSetupFinished;
export const useIsSetupInProgress = () => !useStore().isSetupFinished;
export const useUserLevel = () => useStore().userLevel;

export function useTimeRemaining() {
  const { userPosition } = useStore();

  if (!userPosition.target || !userPosition.currentCoordinates) {
    return 0;
  }

  const timeRemaining =
    calculateDistance(
      userPosition.currentCoordinates,
      userPosition.target.position,
    ) / userPosition.speed;

  return timeRemaining;
}

export function useIsTraveling() {
  const { userPosition } = useStore();

  return userPosition.target !== undefined && userPosition.speed > 0;
}
