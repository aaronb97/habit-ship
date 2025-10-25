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
import { useEffect } from 'react';
import { StatusBar, Platform, Appearance, AppState } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Navigation } from './navigation';
import { colors } from './styles/theme';
import { rescheduleDailyReminders } from './utils/notifications';
import { getCurrentDate } from './utils/time';
import { useStore } from './utils/store';
import { ensureFirebaseId } from './utils/firebaseAuth';

const prefix = createURL('/');

Asset.loadAsync([...NavigationAssets]).catch((e) => {
  console.warn('[App] Failed to preload navigation assets', e);
});
void SplashScreen.preventAutoHideAsync();

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

  const onLayoutRootView = async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  };

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

  // Ensure anonymous Firebase auth whenever firebaseId is missing (first run or after dev resets)
  const firebaseId = useStore((s) => s.firebaseId);
  useEffect(() => {
    if (firebaseId) return;
    const s = useStore.getState();
    void (async () => {
      const uid = await ensureFirebaseId();
      if (uid) s.setFirebaseId(uid);
    })();
  }, [firebaseId]);

  // Reschedule daily reminders when the app becomes active (opened/foregrounded)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const s = useStore.getState();
        const dest = s.userPosition.target?.name ?? s.userPosition.startingLocation;
        const todayKey = getCurrentDate().toDateString();
        const anyCompletedToday = s.habits.some((h) =>
          h.completions.some((ts) => new Date(ts).toDateString() === todayKey),
        );
        void rescheduleDailyReminders(dest, !anyCompletedToday);
      }
    });
    // Also run once on initial mount
    const s = useStore.getState();
    const initialDest = s.userPosition.target?.name ?? s.userPosition.startingLocation;
    const todayKey = getCurrentDate().toDateString();
    const anyCompletedToday = s.habits.some((h) =>
      h.completions.some((ts) => new Date(ts).toDateString() === todayKey),
    );
    void rescheduleDailyReminders(initialDest, !anyCompletedToday);
    return () => sub.remove();
  }, []);

  // Rescheduling on destination is handled in store.setDestination to avoid duplication

  const linking = {
    prefixes: [prefix],
    config: {
      screens: {
        WelcomeTransition: 'welcome',
        Home: 'home',
        NotFound: '*',
      },
      initialRouteName: 'Home' as const,
    },
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <Navigation
        theme={customTheme}
        linking={linking}
        onReady={onLayoutRootView}
      />
    </GestureHandlerRootView>
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
