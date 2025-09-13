import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { mountains } from '../mountains';

export type HabitId = string & { __habitId: true };

export type Habit = {
  id: HabitId;
  title: string;
  description?: string;
  completions: string[];
  timerLength?: number;
};

export type Hike = {
  /**
   * The height of the hiker (initialized to 0)
   */
  height: number;
  mountainName: string;

  /**
   * The energy of the hiker (initialized to 0 and increases by 10 for each completed habit, max of 100)
   */
  energy: number;

  lastEnergyUpdate?: string;
};

type Store = {
  isSetupFinished: boolean;
  habits: Habit[];
  hike?: Hike;
  completedMountains?: string[];
  idCount: number;
  activeTimer?: {
    habitId: HabitId;
    startTime: string;
  };

  setIsSetupFinished: (value: boolean) => void;
  setHike: (hike: Hike) => void;
  completeMountain: (mountainName: string) => void;

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

  clearData: () => void;
};

const initialData = {
  isSetupFinished: false,
  habits: [],
  hike: undefined,
  completedMountains: undefined,
  idCount: 0,
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

          if (!state.hike) throw new Error('No hike found');

          state.hike.energy += 10;
          if (state.hike.energy > 100) {
            state.hike.energy = 100;
          }
        });
      },

      completeMountain: (mountainName: string) => {
        set((state) => {
          if (!state.completedMountains) {
            state.completedMountains = [];
          }

          if (state.completedMountains.includes(mountainName)) {
            return;
          }

          state.completedMountains.push(mountainName);
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

      setHike: (hike) => {
        set((state) => {
          state.hike = hike;
        });
      },

      expendEnergy: () => {
        set((state) => {
          if (!state.hike) throw new Error('No hike found');

          const now = Date.now();
          const lastUpdate = state.hike.lastEnergyUpdate
            ? new Date(state.hike.lastEnergyUpdate).getTime()
            : now;

          const timeSinceLastUpdate = now - lastUpdate;

          // 10% energy should last 1 hour (3,600,000 ms)
          // So 100% energy lasts 10 hours (36,000,000 ms)
          const energyDecrease = (timeSinceLastUpdate / 36000000) * 100;
          const actualEnergyDecrease = Math.min(
            energyDecrease,
            state.hike.energy,
          );

          state.hike.energy -= actualEnergyDecrease;
          state.hike.lastEnergyUpdate = new Date().toISOString();

          if (actualEnergyDecrease > 0) {
            const heightIncrease = ((actualEnergyDecrease / 10) * 548.64) / 2;
            state.hike.height += heightIncrease;

            const mountain = mountains.find(
              (m) => m.name === state.hike!.mountainName,
            );

            if (!mountain) throw new Error('No mountain found');

            state.hike.height = Math.min(state.hike.height, mountain.height);
            if (state.hike.height >= mountain.height) {
              state.completeMountain(mountain.name);
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

      clearData: () => {
        set((state) => {
          Object.assign(state, initialData);
        });
      },
    })),
    {
      name: 'habit-hiker-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export const useIsSetupFinished = () => useStore().isSetupFinished;
export const useIsSetupInProgress = () => !useStore().isSetupFinished;
