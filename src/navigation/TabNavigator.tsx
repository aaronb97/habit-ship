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
import { AntDesign, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Friends } from './screens/Friends';
import * as Device from 'expo-device';
import { useFriendships } from '../hooks/useFriendships';

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
  const uid = useStore((s) => s.firebaseId);
  const {
    accepted,
    incoming,
    outgoing,
    loadingAccepted,
    loadingIncoming,
    loadingOutgoing,
  } = useFriendships(uid);
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
    // Home: FontAwesome5 'tv'
    void FontAwesome5.getImageSource('tv', ICON_SIZE, colors.white).then(
      (source: ImageSourcePropType | null) => {
        if (!source) return;
        setImageSources((prev) => ({ ...prev, homeWhite: source }));
      },
    );
    void FontAwesome5.getImageSource('tv', ICON_SIZE, colors.primary).then(
      (source: ImageSourcePropType | null) => {
        if (!source) return;
        setImageSources((prev) => ({ ...prev, homePrimary: source }));
      },
    );

    void Ionicons.getImageSource(
      'rocket-outline',
      ICON_SIZE,
      colors.white,
    ).then((source: ImageSourcePropType | null) => {
      if (!source) return;
      setImageSources((prev) => ({ ...prev, mapWhite: source }));
    });
    void Ionicons.getImageSource(
      'rocket-outline',
      ICON_SIZE,
      colors.primary,
    ).then((source: ImageSourcePropType | null) => {
      if (!source) return;
      setImageSources((prev) => ({ ...prev, mapPrimary: source }));
    });

    // Profile: FontAwesome5 'user'
    void FontAwesome5.getImageSource('user', ICON_SIZE, colors.white).then(
      (source: ImageSourcePropType | null) => {
        if (!source) return;
        setImageSources((prev) => ({ ...prev, profileWhite: source }));
      },
    );
    void FontAwesome5.getImageSource('user', ICON_SIZE, colors.primary).then(
      (source: ImageSourcePropType | null) => {
        if (!source) return;
        setImageSources((prev) => ({ ...prev, profilePrimary: source }));
      },
    );

    // Friends: FontAwesome5 'user-friends'
    void FontAwesome5.getImageSource(
      'user-friends',
      ICON_SIZE,
      colors.white,
    ).then((source: ImageSourcePropType | null) => {
      if (!source) return;
      setImageSources((prev) => ({ ...prev, friendsWhite: source }));
    });
    void FontAwesome5.getImageSource(
      'user-friends',
      ICON_SIZE,
      colors.primary,
    ).then((source: ImageSourcePropType | null) => {
      if (!source) return;
      setImageSources((prev) => ({ ...prev, friendsPrimary: source }));
    });

    void AntDesign.getImageSource('setting', ICON_SIZE, colors.white).then(
      (source: ImageSourcePropType | null) => {
        if (!source) return;
        setImageSources((prev) => ({ ...prev, devWhite: source }));
      },
    );
    void AntDesign.getImageSource('setting', ICON_SIZE, colors.primary).then(
      (source: ImageSourcePropType | null) => {
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
          ...(imageSources.homeWhite &&
            imageSources.homePrimary && {
              tabBarIcon: ({ focused }) =>
                focused ? imageSources.homePrimary! : imageSources.homeWhite!,
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
        name="FriendsTab"
        options={{
          title: '',
          tabBarBadge: incoming.length > 0 ? String(incoming.length) : undefined,
          ...(imageSources.friendsWhite &&
            imageSources.friendsPrimary && {
              tabBarIcon: ({ focused }) =>
                focused
                  ? imageSources.friendsPrimary!
                  : imageSources.friendsWhite!,
            }),
        }}
        listeners={{
          focus: () => setActiveTab('FriendsTab'),
        }}
      >
        {() => (
          <Friends
            accepted={accepted}
            incoming={incoming}
            outgoing={outgoing}
            loadingAccepted={loadingAccepted}
            loadingIncoming={loadingIncoming}
            loadingOutgoing={loadingOutgoing}
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="ProfileTab"
        component={Profile}
        options={{
          title: '',
          tabBarBadge: unseenSkins.length > 0 ? ' ' : undefined,
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
  FriendsTab: undefined;
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
