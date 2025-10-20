import { Alert, View, StyleSheet, useWindowDimensions } from 'react-native';
import { useStore } from '../../utils/store';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { GestureDetector } from 'react-native-gesture-handler';
import { useComposedGesture } from '../../components/solarsystem/gestures';
import type { CameraController } from '../../components/solarsystem/camera';
import { getController } from '../../components/solarsystem/controllerRegistry';

export function SolarMap() {
  const isFocused = useIsFocused();
  const { width, height } = useWindowDimensions();
  const { justLanded, userPosition } = useStore();
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
        Alert.alert(
          '🎉 Congratulations!',
          `You have landed on ${loc}! Open the Home tab to choose your next destination.`,
        );
      }
    }
  }, [isFocused, justLanded, userPosition.startingLocation]);

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
      <View style={styles.container} pointerEvents="auto" />
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
