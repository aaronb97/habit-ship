import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors, fonts } from '../../styles/theme';
import { Profile } from '../screens/Profile';
import { Settings } from '../screens/Settings';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Settings: undefined;
};

/**
 * Stack navigator hosting the Profile flow to enable a visible header
 * and push navigation to the Settings screen.
 *
 * Returns: JSX element for the profile stack navigator.
 */
export function ProfileStack() {
  const Stack = createNativeStackNavigator<ProfileStackParamList>();
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.primaryText,
        headerBackTitle: 'Back',
        headerBackTitleStyle: { fontFamily: fonts.regular },
      }}
    >
      <Stack.Screen
        name="ProfileMain"
        component={Profile}
        options={{
          title: 'Profile',
        }}
      />

      <Stack.Screen
        name="Settings"
        component={Settings}
        options={{
          title: 'Settings',
        }}
      />
    </Stack.Navigator>
  );
}
