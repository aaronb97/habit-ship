import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import AsyncStorage from '@react-native-async-storage/async-storage';

type HabitId = string & { __habitId: true };

function createHabitId(): HabitId {
  return Date.now().toString() as HabitId;
}

export type Habit = {
  id: HabitId;
  title: string;
  description?: string;
  completions: Date[];
  timerLength?: number;
};

export type Hike = {
  /**
   * The height of the hiker (initialized to 0)
   */
  height: number;
  mountainName: string;
};

type Store = {
  isSetupFinished: boolean;
  setIsSetupFinished: (value: boolean) => void;
  habits: Habit[];
  hike?: Hike;
  setHike: (hike: Hike) => void;

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
            habitToComplete.completions.push(new Date());
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
