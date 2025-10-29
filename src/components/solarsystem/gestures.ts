import { Gesture } from 'react-native-gesture-handler';
import { useRef } from 'react';
import type {
  PinchGestureHandlerEventPayload,
  PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler';
import type { CameraController } from './camera';
import type { RefObject } from 'react';

export function useComposedGesture(params: {
  controllerRef: RefObject<CameraController | null>;
  width: number;
  height: number;
  onDoubleTap?: () => void;
  enabled?: boolean;
}) {
  const { controllerRef, width, height, onDoubleTap, enabled = true } = params;
  const lastPanXRef = useRef(0);
  const lastPanYRef = useRef(0);
  const panStartedRef = useRef(false);

  const pinch = Gesture.Pinch()
    .enabled(enabled)
    .onStart(() => {
      controllerRef.current?.beginPinch();
    })
    .onUpdate((e: PinchGestureHandlerEventPayload) => {
      controllerRef.current?.updatePinch(e.scale);
    })
    .runOnJS(true);

  const pan = Gesture.Pan()
    .enabled(enabled)
    .onStart(() => {
      panStartedRef.current = true;
      controllerRef.current?.beginPan();
      lastPanXRef.current = 0;
      lastPanYRef.current = 0;
    })
    .onUpdate((e: PanGestureHandlerEventPayload) => {
      const prevX = lastPanXRef.current;
      const prevY = lastPanYRef.current;
      const dx = e.translationX - prevX;
      const dy = e.translationY - prevY;
      lastPanXRef.current = e.translationX;
      lastPanYRef.current = e.translationY;
      controllerRef.current?.updatePan(dx, dy, width, height);
    })
    .onEnd((e) => {
      controllerRef.current?.endPan(e.velocityX, e.velocityY, width, height);
      panStartedRef.current = false;
      lastPanXRef.current = 0;
      lastPanYRef.current = 0;
    })
    .onFinalize(() => {
      // If pan began but was cancelled due to another gesture (e.g., pinch/tap),
      // finalize it without inertia to ensure proper cleanup.
      if (panStartedRef.current) {
        controllerRef.current?.endPan(0, 0, width, height);
        panStartedRef.current = false;
      }

      lastPanXRef.current = 0;
      lastPanYRef.current = 0;
    })
    .runOnJS(true);

  const doubleTap = Gesture.Tap()
    .enabled(enabled)
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd((_e, success) => {
      if (success) {
        if (onDoubleTap) {
          onDoubleTap();
        } else {
          controllerRef.current?.resetZoom();
        }
      }
    })
    .runOnJS(true);

  return Gesture.Race(doubleTap, pinch, pan);
}
