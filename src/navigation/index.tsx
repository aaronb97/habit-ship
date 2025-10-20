import {
  NavigationContainer,
  Theme,
  LinkingOptions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors, fonts } from '../styles/theme';
import { TabNavigator } from './TabNavigator';
import { NotFound } from './screens/NotFound';
import { WelcomeTransition } from './screens/WelcomeTransition';

const Stack = createNativeStackNavigator<RootStackParamList>();

type NavigationProps = {
  theme?: Theme;
  linking?: LinkingOptions<RootStackParamList>;
  onReady?: () => void;
};

export function Navigation({ theme, linking, onReady }: NavigationProps) {
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
        <Stack.Screen
          name="Home"
          component={TabNavigator}
          options={{
            headerShown: false,
          }}
        />
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
