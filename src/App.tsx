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
import { useCallback, useMemo, useEffect } from 'react';
import { StatusBar, Platform, Appearance } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Navigation } from './navigation';
import { colors } from './styles/theme';
import { useIsSetupFinished } from './utils/store';

void Asset.loadAsync([...NavigationAssets]);

void SplashScreen.preventAutoHideAsync();

const prefix = createURL('/');

Appearance.setColorScheme('dark');

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

  useEffect(() => {
    void registerForPushNotificationsAsync();

    if (Platform.OS === 'android') {
      void Notifications.getNotificationChannelsAsync();
    }

    const notificationListener = Notifications.addNotificationReceivedListener(
      () => {
        // Handle notification received
      },
    );

    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log(response);
      });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

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
        initialRouteName: isSetupFinished
          ? ('Home' as const)
          : ('SetupFirstHabit' as const),
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

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('myNotificationChannel', {
      name: 'A channel is needed for the permissions prompt to appear',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }

    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (!projectId) {
        throw new Error('Project ID not found');
      }

      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;

      console.log(token);
    } catch (e) {
      token = `${e}`;
    }
  }

  return token;
}
