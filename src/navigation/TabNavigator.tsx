import { View, StyleSheet, Animated } from 'react-native';
import { useRef, useEffect } from 'react';
import { Home } from './screens/Home';
import { SolarMap } from './screens/SolarMap';
import { Dev } from './screens/Dev';
import { colors } from '../styles/theme';
import { useStore } from '../utils/store';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { SolarSystemMap } from '../components/SolarSystemMap';
import { Dashboard } from '../components/Dashboard';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

const Tab = createNativeBottomTabNavigator<TabParamList>();

/**
 * Root tab navigator. Hosts a persistent overlay containing `Dashboard`
 * so it remains mounted across tab switches.
 *
 * Returns: JSX element for the bottom tab navigator with overlays.
 */
export function TabNavigator() {
  // hiddden dev mode
  const isDevelopment =
    useStore((s) => s.habits[0]?.title === 'Dev') || __DEV__;

  const hasFuelAndTarget = useStore(
    (s) => s.fuelKm > 0 && !!s.userPosition.target,
  );

  const homeNeedsSelection = useStore((s) => s.justLanded);
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  // Inline flows now manage destination prompts; no need to read userPosition or level-up modal here.
  const isMapFocused = activeTab === 'MapTab';

  const fadeOpacityRef = useRef<Animated.Value>(
    new Animated.Value(activeTab === 'HomeTab' ? 1 : 0),
  );
  const fadeOpacity = fadeOpacityRef.current;

  useEffect(() => {
    Animated.timing(fadeOpacity, {
      toValue: activeTab === 'HomeTab' ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [activeTab, fadeOpacity]);

  // Inline flows are handled by Dashboard now.

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

      {/* Persistent overlay hosting Dashboard and related modals */}
      <KeyboardAvoidingView
        style={styles.panelOverlay}
        keyboardVerticalOffset={-100}
        pointerEvents="box-none"
        behavior="padding"
      >
        <Animated.View
          pointerEvents={activeTab === 'HomeTab' ? 'auto' : 'none'}
          style={{ opacity: fadeOpacity }}
        >
          <Dashboard />
        </Animated.View>
        {/* Modals removed: flows are inline within Dashboard */}
      </KeyboardAvoidingView>
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
  panelOverlay: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  hidden: {
    opacity: 0,
  },
});
