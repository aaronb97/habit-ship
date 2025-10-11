import { useCallback } from 'react';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';

/**
 * Bare-minimum GL test: no three.js, no shaders, just clear the screen red.
 * If this renders without crashing, expo-gl and the simulator/device GL context are OK.
 */
export function GLBareTest() {
  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    console.log('[GLBareTest] onContextCreate', gl.drawingBufferWidth, gl.drawingBufferHeight);
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
    gl.viewport(0, 0, width, height);

    gl.clearColor(1.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.endFrameEXP();
  }, []);

  return (
    <GLView
      style={{ height: 200, width: '100%' }}
      // Disabling MSAA can prevent crashes on some iOS Simulator GL drivers
      msaaSamples={0}
      onContextCreate={onContextCreate}
    />
  );
}
