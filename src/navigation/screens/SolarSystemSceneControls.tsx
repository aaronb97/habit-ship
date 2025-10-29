import { Alert, View, StyleSheet, useWindowDimensions } from 'react-native';
import { useStore } from '../../utils/store';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { GestureDetector } from 'react-native-gesture-handler';
import { useComposedGesture } from '../../components/solarsystem/gestures';
import type { CameraController } from '../../components/solarsystem/camera';
import { getController } from '../../components/solarsystem/controllerRegistry';
import { HSButton } from '../../components/HSButton';

export function SolarSystemSceneControls() {
  const isFocused = useIsFocused();
  const { width, height } = useWindowDimensions();
  const { justLanded, userPosition } = useStore();
  const fuelKm = useStore((s) => s.fuelKm);
  const lastLandingReward = useStore((s) => s.lastLandingReward);
  const applyFuelToTravel = useStore((s) => s.applyFuelToTravel);
  const shownForLocationRef = useRef<string | null>(null);
  const controllerRef = useRef<CameraController | null>(null);

  // Refresh controller reference on focus changes (and initially)
  useEffect(() => {
    controllerRef.current = getController();
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    if (justLanded) {
      const loc = userPosition.startingLocation;
      if (shownForLocationRef.current !== loc) {
        shownForLocationRef.current = loc;
        const xp = lastLandingReward?.xp ?? 0;
        const money = lastLandingReward?.money ?? 0;

        const alertParts = [
          `You have landed on ${loc}!`,
          xp > 0 ? `You have earned ${xp} XP.` : '',
          money > 0 ? `You have earned ${money} Space Money.` : '',
          'Open the Home tab to choose your next destination.',
        ];

        Alert.alert('Congratulations!', alertParts.join('\n'));
      }
    }
  }, [isFocused, justLanded, userPosition.startingLocation, lastLandingReward]);

  // Reset the local guard when justLanded resets (after visiting Home)
  useEffect(() => {
    if (!justLanded) {
      shownForLocationRef.current = null;
    }
  }, [justLanded]);

  // Compose a gesture layer that forwards to the global map controller
  const gesture = useComposedGesture({
    controllerRef,
    width,
    height,
    onDoubleTap: () => controllerRef.current?.cycleDoubleTap(),
    enabled: isFocused,
  });

  // Transparent gesture surface above the global GL overlay
  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.container}
        pointerEvents="auto"
      >
        {(() => {
          const target = userPosition.target;
          const initialDistance = userPosition.initialDistance;
          const distanceTraveled = userPosition.distanceTraveled ?? 0;
          const previousDistanceTraveled = userPosition.previousDistanceTraveled ?? 0;

          const hasTarget = !!target && typeof initialDistance === 'number';
          const hasDelta = distanceTraveled !== previousDistanceTraveled;
          const isTraveling = hasTarget && distanceTraveled > 0;
          const label = isTraveling ? 'Boost' : 'Launch';
          const initDist = typeof initialDistance === 'number' ? initialDistance : 0;

          const remaining = Math.max(0, initDist - distanceTraveled);
          const canBoost = hasTarget && fuelKm > 0 && !hasDelta && remaining > 0;

          if (!hasTarget || !canBoost) {
            return null;
          }

          return (
            <View
              style={styles.ctaContainer}
              pointerEvents="box-none"
            >
              <HSButton
                onPress={() => {
                  applyFuelToTravel();
                }}
              >
                {label}
              </HSButton>
            </View>
          );
        })()}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  ctaContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 120,
    alignItems: 'center',
  },
});
