import { View, StyleSheet } from 'react-native';
import { useState } from 'react';
import { Home } from './screens/Home';
import { SolarMap } from './screens/SolarMap';
import { Dev } from './screens/Dev';
import { colors } from '../styles/theme';
import { useStore } from '../utils/store';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { SolarSystemMap } from '../components/SolarSystemMap';
import { UnifiedGlassPanel } from '../components/UnifiedGlassPanel';
import { CreateHabitModal } from '../components/CreateHabitModal';
import { PlanetSelectionModal } from '../components/PlanetSelectionModal';

const Tab = createNativeBottomTabNavigator<TabParamList>();

/**
 * Root tab navigator. Hosts a persistent overlay containing `UnifiedGlassPanel`
 * so it remains mounted across tab switches.
 *
 * Returns: JSX element for the bottom tab navigator with overlays.
 */
export function TabNavigator() {
  const isDevelopment = __DEV__;
  const hasFuelAndTarget = useStore(
    (s) => s.fuelKm > 0 && !!s.userPosition.target,
  );

  const homeNeedsSelection = useStore((s) => s.justLanded);
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const addHabit = useStore((s) => s.addHabit);
  const userPosition = useStore((s) => s.userPosition);
  const isLevelUpModalVisible = useStore((s) => s.isLevelUpModalVisible);
  const isMapFocused = activeTab === 'MapTab';

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPlanetModal, setShowPlanetModal] = useState(false);

  /**
   * Handles creating a new habit from the persistent overlay.
   *
   * habit: New habit payload including title, optional description and timerLength.
   * Returns: void
   */
  const handleCreate = (habit: {
    title: string;
    description: string;
    timerLength?: number;
  }) => {
    addHabit(habit);
    setShowCreateModal(false);
  };

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

      {/* Persistent overlay hosting UnifiedGlassPanel and related modals */}
      <View style={styles.panelOverlay} pointerEvents="box-none">
        <View
          pointerEvents={activeTab === 'HomeTab' ? 'auto' : 'none'}
          style={activeTab === 'HomeTab' ? undefined : styles.hidden}
        >
          <UnifiedGlassPanel
            onPressPlanetTitle={() => setShowPlanetModal(true)}
            onPressNewHabit={() => setShowCreateModal(true)}
          />
        </View>
        {/* </View> */}
        <CreateHabitModal
          visible={activeTab === 'HomeTab' && showCreateModal}
          onCreate={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
        <PlanetSelectionModal
          visible={
            activeTab === 'HomeTab' &&
            (showPlanetModal ||
              (!userPosition.target && !isLevelUpModalVisible))
          }
          onClose={() => setShowPlanetModal(false)}
        />
      </View>
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
