import { createStaticNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useIsSetupFinished, useIsSetupInProgress } from '../utils/store';
import { Home } from './screens/Home';
import { NotFound } from './screens/NotFound';
import { SetupFirstHabit } from './screens/SetupFirstHabit';
import { SetupFirstMountain } from './screens/SetupFirstMountain';

const RootStack = createNativeStackNavigator({
  screens: {
    SetupFirstHabit: {
      screen: SetupFirstHabit,
      if: useIsSetupInProgress,
    },
    SetupFirstMountain: {
      screen: SetupFirstMountain,
      if: useIsSetupInProgress,
    },
    Home: {
      screen: Home,
      if: useIsSetupFinished,
      options: {
        title: 'Home',
        headerShown: false,
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
  SetupFirstMountain: {
    habit: {
      title: string;
      description?: string;
      timerLength?: number;
    };
  };
  Home: undefined;
  NotFound: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
