import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
} from 'react';

type SetupContextType = {
  isSetupFinished: boolean;
  setIsSetupFinished: (value: boolean) => Promise<void>;
};

const SetupContext = createContext<SetupContextType | undefined>(undefined);

export const SetupProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isSetupFinished, _setIsSetupFinished] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('setupFinished').then((value) => {
      _setIsSetupFinished(value === 'true');
    });
  }, []);

  const setIsSetupFinished = useCallback(async (value: boolean) => {
    _setIsSetupFinished(value);
    await AsyncStorage.setItem('setupFinished', value ? 'true' : 'false');
  }, []);

  return (
    <SetupContext.Provider value={{ isSetupFinished, setIsSetupFinished }}>
      {children}
    </SetupContext.Provider>
  );
};

export function useSetup() {
  const context = useContext(SetupContext);
  if (context === undefined) {
    throw new Error('useSetup must be used within a SetupProvider');
  }
  return context;
}
