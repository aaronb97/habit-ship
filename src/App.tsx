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
import {
  cancelAllDailyReminders,
  rescheduleDailyRemindersAtLocalTime,
  shouldIncludeTodayReminder,
} from './utils/notifications';
import { getCurrentDate } from './utils/time';
import { useStore } from './utils/store';
import { ensureFirebaseId } from './utils/firebaseAuth';
import { startFirestoreSync } from './utils/firestoreSync';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://d78e59ce600be87378215f012a6376e6@o4510264180670464.ingest.us.sentry.io/4510264180932608',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [
    Sentry.mobileReplayIntegration(),
    Sentry.consoleLoggingIntegration({
      levels: ['error'],
    }),
  ],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

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

function App() {
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

    const notificationListener = Notifications.addNotificationReceivedListener(() => {
      // Handle notification received
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
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
    if (firebaseId) {
      return;
    }

    const s = useStore.getState();
    void (async () => {
      const uid = await ensureFirebaseId();
      if (uid) {
        s.setFirebaseId(uid);
      }
    })();
  }, [firebaseId]);

  // Mirror Zustand store to Firestore (device-only source of truth)
  useEffect(() => {
    if (!firebaseId) {
      return;
    }

    const stop = startFirestoreSync(firebaseId);
    return () => stop();
  }, [firebaseId]);

  // Reschedule daily reminders when the app becomes active (opened/foregrounded)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const s = useStore.getState();
        const dest = s.userPosition.target ?? s.userPosition.startingLocation;
        const includeToday = shouldIncludeTodayReminder(s.habits, getCurrentDate());

        const mins = s.dailyReminderMinutesLocal;
        if (mins === 'off' || mins === 'unset') {
          void cancelAllDailyReminders();
        } else {
          void rescheduleDailyRemindersAtLocalTime(dest, mins, includeToday);
        }
      }
    });

    // Also run once on initial mount
    const s = useStore.getState();
    const initialDest = s.userPosition.target ?? s.userPosition.startingLocation;

    const includeToday = shouldIncludeTodayReminder(s.habits, getCurrentDate());

    const mins = s.dailyReminderMinutesLocal;
    if (mins === 'off' || mins === 'unset') {
      void cancelAllDailyReminders();
    } else {
      void rescheduleDailyRemindersAtLocalTime(initialDest, mins, includeToday);
    }
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
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.background}
      />

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
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    const s = useStore.getState();

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('Requesting push notification permissions', { user: s.username });
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    } else {
      console.log('Push notification permissions already granted', { user: s.username });
    }

    if (finalStatus !== 'granted') {
      console.error('Failed to get push token for push notification; status: ' + finalStatus, {
        user: s.username,
      });
      return;
    }

    console.log('Successfully got push token for push notification; status: ' + finalStatus, {
      user: s.username,
    });

    // Permission granted: only default reminders if unset
    if (s.dailyReminderMinutesLocal === 'unset') {
      console.log('Setting default daily reminder time', { user: s.username });
      void s.setDailyReminderMinutesLocal(21 * 60);
    } else {
      console.log('Using existing daily reminder time', { user: s.username });
    }

    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

      if (!projectId) {
        throw new Error('Project ID not found');
      }

      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
    } catch (e) {
      token = `${e}`;
    }
  }

  return token;
}

export default Sentry.wrap(App);
