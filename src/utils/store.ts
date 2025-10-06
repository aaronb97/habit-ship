import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { planets } from '../planets';
import {
  UserLevel,
  XPGain,
  XP_REWARDS,
  calculateLevel,
  getCurrentLevelXP,
} from '../types';
import { Meter } from './units';

export type HabitId = string & { __habitId: true };

export type Habit = {
  id: HabitId;
  title: string;
  description?: string;
  completions: string[];
  timerLength?: number;
};

export type Journey = {
  /**
   * The distance traveled (initialized to 0)
   */
  distance: Meter;
  planetName: string;

  /**
   * The fuel/energy (initialized to 0 and increases by 10 for each completed habit, max of 100)
   */
  energy: number;

  lastEnergyUpdate?: string;
};

type Store = {
  isSetupFinished: boolean;
  habits: Habit[];
  journey?: Journey;
  completedPlanets?: string[];
  userLevel: UserLevel;
  xpHistory: XPGain[];
  idCount: number;
  activeTimer?: {
    habitId: HabitId;
    startTime: string;
  };
  swipedHabitId?: HabitId;

  setIsSetupFinished: (value: boolean) => void;
  setJourney: (journey: Journey) => void;
  completePlanet: (planetName: string) => void;

  /**
   * Compares the current time to the last energy update and updates the energy accordingly
   */
  expendEnergy: () => void;

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
  journey: undefined,
  completedPlanets: undefined,
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

          if (!state.journey) throw new Error('No journey found');

          state.journey.energy += 10;
          if (state.journey.energy > 100) {
            state.journey.energy = 100;
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
        });
      },

      completePlanet: (planetName: string) => {
        set((state) => {
          if (!state.completedPlanets) {
            state.completedPlanets = [];
          }

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

      setJourney: (journey) => {
        set((state) => {
          state.journey = journey;
        });
      },

      expendEnergy: () => {
        set((state) => {
          if (!state.journey) throw new Error('No journey found');

          const now = Date.now();
          const lastUpdate = state.journey.lastEnergyUpdate
            ? new Date(state.journey.lastEnergyUpdate).getTime()
            : now;

          const timeSinceLastUpdate = now - lastUpdate;

          // 10% energy should last 1 hour (3,600,000 ms)
          // So 100% energy lasts 10 hours (36,000,000 ms)
          const energyDecrease = (timeSinceLastUpdate / 36000000) * 100;
          const actualEnergyDecrease = Math.min(
            energyDecrease,
            state.journey.energy,
          );

          state.journey.energy -= actualEnergyDecrease;
          state.journey.lastEnergyUpdate = new Date().toISOString();

          if (actualEnergyDecrease > 0) {
            const distanceIncrease = ((actualEnergyDecrease / 10) * 548.64) / 2;
            state.journey.distance = (state.journey.distance + distanceIncrease) as Meter;

            const planet = planets.find(
              (p) => p.name === state.journey!.planetName,
            );

            if (!planet) throw new Error('No planet found');

            state.journey.distance = Math.min(
              state.journey.distance,
              planet.distance,
            ) as Meter;

            if (state.journey.distance >= planet.distance) {
              state.completePlanet(planet.name);
            }
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
