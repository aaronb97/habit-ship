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
}) {
  const { controllerRef, width, height, onDoubleTap } = params;
  const lastPanXRef = useRef(0);
  const lastPanYRef = useRef(0);

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      controllerRef.current?.beginPinch();
    })
    .onUpdate((e: PinchGestureHandlerEventPayload) => {
      controllerRef.current?.updatePinch(e.scale);
    })
    .runOnJS(true);

  const pan = Gesture.Pan()
    .onBegin(() => {
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
      lastPanXRef.current = 0;
      lastPanYRef.current = 0;
    })
    .onFinalize(() => {
      lastPanXRef.current = 0;
      lastPanYRef.current = 0;
    })
    .runOnJS(true);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd((_e, success) => {
      if (success) {
        if (onDoubleTap) onDoubleTap();
        else controllerRef.current?.resetZoom();
      }
    })
    .runOnJS(true);

  return Gesture.Race(doubleTap, pinch, pan);
}
