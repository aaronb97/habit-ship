const IS_DEV = process.env.APP_VARIANT === 'development';

export default {
  name: IS_DEV ? 'HabitShip (Dev)' : 'HabitShip',
  slug: 'habit-ship',
  version: '0.2.0',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  scheme: 'habit-ship',
  ios: {
    supportsTablet: true,
    bundleIdentifier: IS_DEV ? 'com.habit-ship-dev' : 'com.habit-ship',
    googleServicesFile: './GoogleService-Info.plist',
    teamId: 'SZ3Q2Y73R2',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      UISupportedInterfaceOrientations: [
        'UIInterfaceOrientationPortrait',
        'UIInterfaceOrientationPortraitUpsideDown',
      ],
      'UISupportedInterfaceOrientations~ipad': [
        'UIInterfaceOrientationPortrait',
        'UIInterfaceOrientationPortraitUpsideDown',
        'UIInterfaceOrientationLandscapeLeft',
        'UIInterfaceOrientationLandscapeRight',
      ],
    },
  },
  android: {
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: IS_DEV ? 'habit.ship.dev' : 'habit.ship',
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    [
      'expo-dev-client',
      {
        launchMode: 'most-recent',
      },
    ],
    'expo-asset',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0b0f26',
        image: './assets/splash-icon.png',
      },
    ],
    'react-native-edge-to-edge',
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    '@react-native-firebase/crashlytics',
    'react-native-bottom-tabs',
    [
      'expo-build-properties',
      {
        ios: {
          useFrameworks: 'static',
          forceStaticLinking: ['RNFBApp', 'RNFBAuth', 'RNFBFirestore'],
        },
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io/',
        project: 'react-native',
        organization: 'space-game-llc',
      },
    ],
  ],
  experiments: {
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: 'e69883de-f80f-4831-a942-84ee9d651dde',
    },
  },
  owner: 'aaron9becker7',
};
