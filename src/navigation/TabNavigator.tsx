import { View, StyleSheet } from 'react-native';
import { Home } from './screens/Home';
import { SolarMap } from './screens/SolarMap';
import { Dev } from './screens/Dev';
import { colors } from '../styles/theme';
import { useStore } from '../utils/store';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { SolarSystemMap } from '../components/SolarSystemMap';

const Tab = createNativeBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  const isDevelopment = __DEV__;
  const hasFuelAndTarget = useStore(
    (s) => s.fuelKm > 0 && !!s.userPosition.target,
  );

  const homeNeedsSelection = useStore((s) => s.justLanded);
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const isMapFocused = activeTab === 'MapTab';

  return (
    <View style={styles.container}>
      <View style={styles.mapOverlay} pointerEvents={'none'}>
        <SolarSystemMap interactive={isMapFocused} />
      </View>
      <Tab.Navigator
        screenOptions={{
          // headerShown: false,
          tabBarActiveTintColor: colors.primary,
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={Home}
          options={{
            title: 'Home',
            tabBarBadge: homeNeedsSelection ? ' ' : undefined,
            tabBarIcon: () => ({ sfSymbol: 'house' }),
          }}
          listeners={{
            focus: () => setActiveTab('HomeTab'),
          }}
        />
        <Tab.Screen
          name="MapTab"
          component={SolarMap}
          options={{
            title: 'Map',
            tabBarBadge: hasFuelAndTarget ? ' ' : undefined,
            tabBarIcon: () => ({ sfSymbol: 'map' }),
          }}
          listeners={{
            focus: () => setActiveTab('MapTab'),
          }}
        />
        {isDevelopment && (
          <Tab.Screen
            name="DevTab"
            component={Dev}
            options={{
              title: 'Dev',
              tabBarIcon: () => ({ sfSymbol: 'gear' }),
            }}
            listeners={{
              focus: () => setActiveTab('DevTab'),
            }}
          />
        )}
      </Tab.Navigator>
    </View>
  );
}

export type TabParamList = {
  HomeTab: undefined;
  MapTab: undefined;
  DevTab: undefined;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
