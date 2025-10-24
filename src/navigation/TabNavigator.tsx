import { View, StyleSheet, Animated, ImageSourcePropType } from 'react-native';
import { useRef, useEffect, useState } from 'react';
import { Home } from './screens/Home';
import { SolarMap } from './screens/SolarMap';
import { Profile } from './screens/Profile';
import { Dev } from './screens/Dev';
import { colors } from '../styles/theme';
import { useStore } from '../utils/store';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { SolarSystemMap } from '../components/SolarSystemMap';
import { Dashboard } from '../components/Dashboard';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';

const ICON_SIZE = 24;

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
  const unseenSkins = useStore((s) => s.unseenUnlockedSkins);
  const isSetupFinished = useStore((s) => s.isSetupFinished);
  // Inline flows now manage destination prompts; no need to read userPosition or level-up modal here.
  const isMapFocused = activeTab === 'MapTab';

  const fadeOpacityRef = useRef<Animated.Value>(
    new Animated.Value(activeTab === 'HomeTab' ? 1 : 0),
  );

  const fadeOpacity = fadeOpacityRef.current;

  const [imageSources, setImageSources] = useState<
    Record<string, ImageSourcePropType>
  >({});

  useEffect(() => {
    void AntDesign.getImageSource('dashboard', ICON_SIZE, colors.white).then(
      (source) => {
        if (!source) return;
        setImageSources((prev) => ({ ...prev, dashboardWhite: source }));
      },
    );
    void AntDesign.getImageSource('dashboard', ICON_SIZE, colors.primary).then(
      (source) => {
        if (!source) return;
        setImageSources((prev) => ({ ...prev, dashboardPrimary: source }));
      },
    );

    void Ionicons.getImageSource(
      'rocket-outline',
      ICON_SIZE,
      colors.white,
    ).then((source) => {
      if (!source) return;
      setImageSources((prev) => ({ ...prev, mapWhite: source }));
    });
    void Ionicons.getImageSource(
      'rocket-outline',
      ICON_SIZE,
      colors.primary,
    ).then((source) => {
      if (!source) return;
      setImageSources((prev) => ({ ...prev, mapPrimary: source }));
    });

    void Ionicons.getImageSource(
      'person-circle-outline',
      ICON_SIZE,
      colors.white,
    ).then((source) => {
      if (!source) return;
      setImageSources((prev) => ({ ...prev, profileWhite: source }));
    });
    void Ionicons.getImageSource(
      'person-circle-outline',
      ICON_SIZE,
      colors.primary,
    ).then((source) => {
      if (!source) return;
      setImageSources((prev) => ({ ...prev, profilePrimary: source }));
    });

    void AntDesign.getImageSource('setting', ICON_SIZE, colors.white).then(
      (source) => {
        if (!source) return;
        setImageSources((prev) => ({ ...prev, devWhite: source }));
      },
    );
    void AntDesign.getImageSource('setting', ICON_SIZE, colors.primary).then(
      (source) => {
        if (!source) return;
        setImageSources((prev) => ({ ...prev, devPrimary: source }));
      },
    );
  }, []);

  useEffect(() => {
    Animated.timing(fadeOpacity, {
      toValue: activeTab === 'HomeTab' ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [activeTab, fadeOpacity]);

  // Inline flows are handled by Dashboard now.

  const tabs = (
    <Tab.Navigator
      screenOptions={{
        // headerShown: false,
        tabBarItemHidden: !isSetupFinished,
        tabBarActiveTintColor: colors.primary,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={Home}
        options={{
          title: '',
          tabBarBadge: homeNeedsSelection ? ' ' : undefined,
          ...(imageSources.dashboardWhite &&
            imageSources.dashboardPrimary && {
              tabBarIcon: ({ focused }) =>
                focused
                  ? imageSources.dashboardPrimary!
                  : imageSources.dashboardWhite!,
            }),
        }}
        listeners={{
          focus: () => setActiveTab('HomeTab'),
        }}
      />
      <Tab.Screen
        name="MapTab"
        component={SolarMap}
        options={{
          title: '',
          tabBarBadge: hasFuelAndTarget ? ' ' : undefined,
          ...(imageSources.mapWhite &&
            imageSources.mapPrimary && {
              tabBarIcon: ({ focused }) =>
                focused ? imageSources.mapPrimary! : imageSources.mapWhite!,
            }),
        }}
        listeners={{
          focus: () => setActiveTab('MapTab'),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={Profile}
        options={{
          title: '',
          tabBarBadge: unseenSkins.length > 0 ? ' ' : undefined,
          tabBarIcon: () => ({ sfSymbol: 'person.crop.circle' }),
          ...(imageSources.profileWhite &&
            imageSources.profilePrimary && {
              tabBarIcon: ({ focused }) =>
                focused
                  ? imageSources.profilePrimary!
                  : imageSources.profileWhite!,
            }),
        }}
        listeners={{
          focus: () => {
            setActiveTab('ProfileTab');
          },
        }}
      />
      {isDevelopment && (
        <Tab.Screen
          name="DevTab"
          component={Dev}
          options={{
            title: '',
            tabBarIcon: () => ({ sfSymbol: 'gear' }),
            ...(imageSources.devWhite &&
              imageSources.devPrimary && {
                tabBarIcon: ({ focused }) =>
                  focused ? imageSources.devPrimary! : imageSources.devWhite!,
              }),
          }}
          listeners={{
            focus: () => setActiveTab('DevTab'),
          }}
        />
      )}
    </Tab.Navigator>
  );

  return (
    <View style={styles.container}>
      {/* SolarSystemMap doesn't work on emulators */}
      {Device.isDevice && (
        <View style={styles.mapOverlay} pointerEvents={'none'}>
          <SolarSystemMap interactive={isMapFocused} />
        </View>
      )}
      {tabs}

      {/* Persistent overlay hosting Dashboard and related modals */}
      <KeyboardAvoidingView
        style={styles.panelOverlay}
        keyboardVerticalOffset={-100}
        pointerEvents="box-none"
        behavior="padding"
      >
        <Animated.View
          pointerEvents={activeTab === 'HomeTab' ? 'auto' : 'none'}
          style={{
            opacity: fadeOpacity,
            alignSelf: 'center',
          }}
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
  ProfileTab: undefined;
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
