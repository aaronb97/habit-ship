import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { Assets as NavigationAssets } from '@react-navigation/elements';
import { DefaultTheme } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import { createURL } from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useMemo } from 'react';
import { StatusBar } from 'react-native';
import { Navigation } from './navigation';
import { colors } from './styles/theme';
import { useIsSetupFinished } from './utils/store';

void Asset.loadAsync([...NavigationAssets]);

void SplashScreen.preventAutoHideAsync();

const prefix = createURL('/');

const customTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.card,
    text: colors.text,
    primary: colors.primary,
  },
};

export function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const isSetupFinished = useIsSetupFinished();

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const linking = useMemo(
    () => ({
      prefixes: [prefix],
      config: {
        screens: {
          SetupFirstHabit: 'setup/habit',
          SetupFirstPlanet: 'setup/planet',
          WelcomeTransition: 'welcome',
          Home: 'home',
          NotFound: '*',
        },
        initialRouteName: (isSetupFinished ? 'Home' : 'SetupFirstHabit') as 'Home' | 'SetupFirstHabit',
      },
    }),
    [isSetupFinished],
  );

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <Navigation
        theme={customTheme}
        linking={linking}
        onReady={onLayoutRootView}
      />
    </>
  );
}
