import { createStaticNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useIsSetupFinished, useIsSetupInProgress } from '../utils/store';
import { colors, fonts } from '../styles/theme';
import { Home } from './screens/Home';
import { NotFound } from './screens/NotFound';
import { SetupFirstHabit } from './screens/SetupFirstHabit';
import { SetupFirstPlanet } from './screens/SetupFirstPlanet';
import { WelcomeTransition } from './screens/WelcomeTransition';

const RootStack = createNativeStackNavigator({
  screenOptions: {
    headerTintColor: colors.primaryText,
    headerBackTitle: 'Back',
    headerBackTitleStyle: {
      fontFamily: fonts.regular,
      color: colors.primaryText,
    },
  },
  initialRouteName: 'SetupFirstHabit',
  screens: {
    SetupFirstHabit: {
      screen: SetupFirstHabit,
      if: useIsSetupInProgress,
      options: {
        title: '',
        headerTransparent: true,
        headerShadowVisible: false,
      },
    },
    SetupFirstPlanet: {
      screen: SetupFirstPlanet,
      if: useIsSetupInProgress,
      options: {
        title: '',
        headerTransparent: true,
        headerShadowVisible: false,
      },
    },
    WelcomeTransition: {
      screen: WelcomeTransition,
      options: {
        headerShown: false,
      },
    },
    Home: {
      screen: Home,
      if: useIsSetupFinished,
      options: {
        title: '',
        headerTransparent: true,
        headerShadowVisible: false,
      },
    },
    NotFound: {
      screen: NotFound,
      options: {
        title: '404',
      },
      linking: {
        path: '*',
      },
    },
  },
});

export const Navigation = createStaticNavigation(RootStack);

export type RootStackParamList = {
  SetupFirstHabit: undefined;
  SetupFirstPlanet: {
    habit: {
      title: string;
      description?: string;
      timerLength?: number;
    };
  };
  WelcomeTransition: undefined;
  Home: undefined;
  NotFound: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
