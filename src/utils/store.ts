import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SetupState = {
  isSetupFinished: boolean;
  setIsSetupFinished: (value: boolean) => void;
};

export const useStore = create<SetupState>()(
  persist(
    (set) => ({
      isSetupFinished: false,
      setIsSetupFinished: (value: boolean) => {
        set({ isSetupFinished: value });
      },
    }),
    {
      name: 'setup-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
