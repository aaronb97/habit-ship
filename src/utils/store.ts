import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mountains } from '../mountains';

export type HabitId = string & { __habitId: true };

function createHabitId(): HabitId {
  return Date.now().toString() as HabitId;
}

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
  setIsSetupFinished: (value: boolean) => void;
  habits: Habit[];
  hike?: Hike;
  setHike: (hike: Hike) => void;

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

  clearData: () => void;
};

export const useStore = create<Store>()(
  persist(
    immer((set) => ({
      isSetupFinished: false,
      setIsSetupFinished: (value: boolean) => {
        set((state) => {
          state.isSetupFinished = value;
        });
      },

      habits: [],
      addHabit: (habit) => {
        set((state) => {
          state.habits.push({
            ...habit,
            id: createHabitId(),
            completions: [],
          });
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
            // Height increase based on energy decrease: 10 energy = 548.64 meters
            const heightIncrease = (actualEnergyDecrease / 10) * 548.64;
            state.hike.height += heightIncrease;

            const mountain = mountains.find(
              (mountain) => mountain.name === state.hike!.mountainName,
            );

            if (mountain) {
              state.hike.height = Math.min(state.hike.height, mountain.height);
            }
          }
        });
      },

      clearData: () => {
        set((state) => {
          state.isSetupFinished = false;
          state.habits = [];
          state.hike = undefined;
        });
      },
    })),
    {
      name: 'habit-hiker-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
