import {
  NavigationContainer,
  Theme,
  LinkingOptions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors, fonts } from '../styles/theme';
import { TabNavigator } from './TabNavigator';
import { NotFound } from './screens/NotFound';
import { SetupFirstHabit } from './screens/SetupFirstHabit';
import { SetupFirstPlanet } from './screens/SetupFirstPlanet';
import { WelcomeTransition } from './screens/WelcomeTransition';
import { useIsSetupFinished } from '../utils/store';

const Stack = createNativeStackNavigator<RootStackParamList>();

type NavigationProps = {
  theme?: Theme;
  linking?: LinkingOptions<RootStackParamList>;
  onReady?: () => void;
};

export function Navigation({ theme, linking, onReady }: NavigationProps) {
  const isSetupFinished = useIsSetupFinished();

  return (
    <NavigationContainer theme={theme} linking={linking} onReady={onReady}>
      <Stack.Navigator
        screenOptions={{
          headerTintColor: colors.primaryText,
          headerBackTitle: 'Back',
          headerBackTitleStyle: {
            fontFamily: fonts.regular,
          },
        }}
      >
        {!isSetupFinished ? (
          <>
            <Stack.Screen
              name="SetupFirstHabit"
              component={SetupFirstHabit}
              options={{
                title: '',
                headerTransparent: true,
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="SetupFirstPlanet"
              component={SetupFirstPlanet}
              options={{
                title: '',
                headerTransparent: true,
                headerShadowVisible: false,
              }}
            />
          </>
        ) : (
          <Stack.Screen
            name="Home"
            component={TabNavigator}
            options={{
              headerShown: false,
            }}
          />
        )}
        <Stack.Screen
          name="WelcomeTransition"
          component={WelcomeTransition}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="NotFound"
          component={NotFound}
          options={{
            title: '404',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export type RootStackParamList = {
  SetupFirstHabit: undefined;
  SetupFirstPlanet: {
    habit: {
      title: string;
      description?: string;
      timerLength?: number; // in seconds
    };
  };
  WelcomeTransition: undefined;
  Home: undefined;
  NotFound: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
