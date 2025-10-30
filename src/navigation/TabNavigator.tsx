import { View, StyleSheet, Animated, ImageSourcePropType } from 'react-native';
import React, { useRef, useEffect, useState } from 'react';
import { Home } from './screens/Home';
import { SolarSystemSceneControls } from './screens/SolarSystemSceneControls';
import { Dev } from './screens/Dev';
import { colors } from '../styles/theme';
import { useStore } from '../utils/store';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { SolarSystemScene } from '../components/SolarSystemScene';
import { Dashboard } from '../components/Dashboard';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { Friends } from './screens/Friends';
import { ProfileStack } from './stacks/ProfileStack';
import * as Device from 'expo-device';
import { useFriendships } from '../hooks/useFriendships';
import { useAllUsers } from '../hooks/useAllUsers';
import { CameraController } from '../utils/solarsystem/camera';

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
  const isDevelopment = useStore((s) => s.habits[0]?.title === 'Dev') || __DEV__;

  const hasFuelAndTarget = useStore((s) => s.fuelKm > 0 && !!s.userPosition.target);

  const cameraController = useRef(new CameraController());

  const {
    justLanded: homeNeedsSelection,
    activeTab,
    setActiveTab,
    unseenUnlockedSkins: unseenSkins,
    isSetupFinished,
    firebaseId: uid,
    showAllRockets,
  } = useStore();

  const {
    accepted,
    incoming,
    outgoing,
    loadingAccepted,
    loadingIncoming,
    loadingOutgoing,
    friendProfiles,
  } = useFriendships(uid);

  const { profiles: allProfiles } = useAllUsers(!!showAllRockets);
  // Inline flows now manage destination prompts; no need to read userPosition or level-up modal here.
  const isMapFocused = activeTab === 'MapTab';

  const fadeOpacityRef = useRef<Animated.Value>(
    new Animated.Value(activeTab === 'HomeTab' ? 1 : 0),
  );

  const fadeOpacity = fadeOpacityRef.current;

  const [imageSources, setImageSources] = useState<Record<string, ImageSourcePropType>>({});

  useEffect(() => {
    const iconNames = [
      { key: 'home', name: 'tv-outline' },
      { key: 'map', name: 'rocket-outline' },
      { key: 'profile', name: 'person-outline' },
      { key: 'friends', name: 'people-outline' },
      { key: 'dev', name: 'cog-outline' },
    ] as const;

    iconNames.forEach(({ key, name }) => {
      void Ionicons.getImageSource(name, ICON_SIZE, 'inherit').then(
        (source: ImageSourcePropType | null) => {
          if (!source) {
            return;
          }

          setImageSources((prev) => ({ ...prev, [key]: source }));
        },
      );
    });
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
          title: Device.deviceType === Device.DeviceType.TABLET ? 'Dashboard' : '',
          tabBarBadge: homeNeedsSelection ? ' ' : undefined,
          ...(imageSources.home && {
            tabBarIcon: () => imageSources.home!,
          }),
        }}
        listeners={{
          focus: () => setActiveTab('HomeTab'),
        }}
      />

      <Tab.Screen
        name="MapTab"
        options={{
          title: Device.deviceType === Device.DeviceType.TABLET ? 'Rocket' : '',
          tabBarBadge: hasFuelAndTarget ? ' ' : undefined,
          ...(imageSources.map && {
            tabBarIcon: () => imageSources.map!,
          }),
        }}
        listeners={{
          focus: () => setActiveTab('MapTab'),
        }}
      >
        {() => <SolarSystemSceneControls cameraController={cameraController.current} />}
      </Tab.Screen>

      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          title: Device.deviceType === Device.DeviceType.TABLET ? 'Profile' : '',
          tabBarBadge: unseenSkins.length > 0 ? ' ' : undefined,
          ...(imageSources.profile && {
            tabBarIcon: () => imageSources.profile!,
          }),
        }}
        listeners={{
          focus: () => {
            setActiveTab('ProfileTab');
          },
        }}
      />

      <Tab.Screen
        name="FriendsTab"
        options={{
          title: Device.deviceType === Device.DeviceType.TABLET ? 'Friends' : '',
          tabBarBadge: incoming.length > 0 ? String(incoming.length) : undefined,
          ...(imageSources.friends && {
            tabBarIcon: () => imageSources.friends!,
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
            friendProfiles={friendProfiles}
          />
        )}
      </Tab.Screen>

      {isDevelopment && (
        <Tab.Screen
          name="DevTab"
          component={Dev}
          options={{
            title: Device.deviceType === Device.DeviceType.TABLET ? 'Dev' : '',
            tabBarIcon: () => ({ sfSymbol: 'gear' }),
            ...(imageSources.dev && {
              tabBarIcon: () => imageSources.dev!,
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
      {/* SolarSystemScene doesn't work on emulators */}
      {Device.isDevice && (
        <View
          style={styles.mapOverlay}
          pointerEvents={'none'}
        >
          {(() => {
            // Build friend entries (uid + profile) without useMemo for React compiler compatibility
            const friendEntries = (() => {
              if (showAllRockets) {
                return Object.entries(allProfiles)
                  .filter(([id, profile]) => !!profile && id !== uid)
                  .map(([id, profile]) => ({
                    uid: id,
                    profile: profile as import('../utils/db').UsersDoc,
                  }));
              }

              const friendUids = new Set(
                accepted.map((f) => (f.user1 === uid ? f.user2 : f.user1)),
              );

              return Array.from(friendUids)
                .map((fid) => {
                  const profile = friendProfiles[fid];
                  return profile ? { uid: fid, profile } : undefined;
                })
                .filter(Boolean) as {
                uid: string;
                profile: import('../utils/db').UsersDoc;
              }[];
            })();

            return (
              <SolarSystemScene
                interactive={isMapFocused}
                friends={friendEntries}
                cameraController={cameraController.current}
              />
            );
          })()}
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
