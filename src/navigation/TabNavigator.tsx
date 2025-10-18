// import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home } from './screens/Home';
import { Planets } from './screens/Planets';
import { SolarMap } from './screens/SolarMap';
import { Dev } from './screens/Dev';
import { colors } from '../styles/theme';
// import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../utils/store';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';

const Tab = createNativeBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  const isDevelopment = __DEV__;
  const pendingMapAnim = useStore(
    (s) => s.pendingTravelAnimation || s.pendingLanding,
  );

  const homeNeedsSelection = useStore((s) => s.justLanded);

  return (
    <Tab.Navigator
      screenOptions={{
        // headerShown: false,
        tabBarActiveTintColor: colors.primary,
        // tabBarInactiveTintColor: colors.text,
        // tabBarStyle: {
        //   backgroundColor: colors.background,
        //   borderTopColor: colors.border || '#333',
        // },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={Home}
        options={{
          title: 'Home',
          tabBarBadge: homeNeedsSelection ? '' : undefined,
          // tabBarBadgeStyle: {
          //   backgroundColor: colors.accent,
          //   maxWidth: 10,
          //   maxHeight: 10,
          //   fontSize: 8,
          //   lineHeight: 9,
          //   alignSelf: undefined,
          // },
          tabBarIcon: () => ({ sfSymbol: 'house' }),
        }}
      />
      <Tab.Screen
        name="PlanetsTab"
        component={Planets}
        options={{
          title: 'Planets',
          tabBarIcon: ({ focused }) => ({ sfSymbol: 'list.bullet' }),
          // tabBarIcon: ({ color, size }) => (
          //   <Ionicons name="list" size={size} color={color} />
          // ),
        }}
      />
      <Tab.Screen
        name="MapTab"
        component={SolarMap}
        options={{
          title: 'Map',
          tabBarBadge: pendingMapAnim ? '' : undefined,
          // tabBarBadgeStyle: {
          //   backgroundColor: colors.accent,
          //   maxWidth: 10,
          //   maxHeight: 10,
          //   fontSize: 8,
          //   lineHeight: 9,
          //   alignSelf: undefined,
          // },
          tabBarIcon: ({ focused }) => ({ sfSymbol: 'map' }),
        }}
      />
      {isDevelopment && (
        <Tab.Screen
          name="DevTab"
          component={Dev}
          options={{
            title: 'Dev',
            tabBarIcon: ({ focused }) => ({ sfSymbol: 'gear' }),
          }}
        />
      )}
    </Tab.Navigator>
  );
}

export type TabParamList = {
  HomeTab: undefined;
  PlanetsTab: undefined;
  MapTab: undefined;
  DevTab: undefined;
};
