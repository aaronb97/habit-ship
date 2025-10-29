import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import type { Renderer } from 'expo-three';
import { createTiltShiftPasses } from './tiltshift';
import { useStore } from '../../utils/store';

export function createComposer(
  renderer: Renderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  size: THREE.Vector2,
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.setSize(size.x, size.y);
  const currentSize = new THREE.Vector2(size.x, size.y);

  const renderPass = new RenderPass(scene, camera);
  // Always render to composer, and have a final copy to screen for consistency
  renderPass.renderToScreen = false;
  composer.addPass(renderPass);

  // Tilt-shift (miniature) dual-pass blur, controlled by global store
  const initialTilt = {
    enabled: Boolean(useStore.getState().tiltShiftEnabled),
    focus: useStore.getState().tiltShiftFocus,
    range: useStore.getState().tiltShiftRange,
    feather: useStore.getState().tiltShiftFeather,
    blur: useStore.getState().tiltShiftBlur,
  };

  const tilt = createTiltShiftPasses(new THREE.Vector2(size.x, size.y), initialTilt);

  composer.addPass(tilt.horizontal);
  composer.addPass(tilt.vertical);

  const copyPass = new ShaderPass(CopyShader);
  copyPass.renderToScreen = true;
  composer.addPass(copyPass);

  // Keep shader resolution synced with composer size
  const originalSetSize = composer.setSize.bind(composer);
  composer.setSize = (w: number, h: number) => {
    originalSetSize(w, h);
    currentSize.set(w, h);
    tilt.setSize(currentSize);
  };

  // Ensure any passes added later (e.g., OutlinePass) render BEFORE tilt passes
  const originalAddPass = composer.addPass.bind(composer);
  composer.addPass = (pass: unknown) => {
    const withPasses = composer as unknown as { passes: unknown[] };
    const arr = withPasses.passes;
    const tiltIndex = arr.indexOf(tilt.horizontal);
    if (tiltIndex >= 0) {
      // Insert just before the first tilt pass so tilt remains at the end
      arr.splice(tiltIndex, 0, pass);
      const maybe = pass as { setSize?: (w: number, h: number) => void };
      if (typeof maybe.setSize === 'function') {
        maybe.setSize(currentSize.x, currentSize.y);
      }
    } else {
      originalAddPass(pass);
    }
  };

  // Subscribe to store and update shader uniforms (no selector middleware)
  type RootState = ReturnType<typeof useStore.getState>;
  let prev: {
    enabled: boolean;
    focus: number;
    range: number;
    feather: number;
    blur: number;
  } | null = null;

  const unsub = useStore.subscribe((s: RootState, _prev: RootState) => {
    const curr = {
      enabled: Boolean(s.tiltShiftEnabled),
      focus: s.tiltShiftFocus,
      range: s.tiltShiftRange,
      feather: s.tiltShiftFeather,
      blur: s.tiltShiftBlur,
    };

    if (
      !prev ||
      prev.enabled !== curr.enabled ||
      prev.focus !== curr.focus ||
      prev.range !== curr.range ||
      prev.feather !== curr.feather ||
      prev.blur !== curr.blur
    ) {
      tilt.update(curr);
      prev = curr;
    }
  });

  // Ensure we clean up subscription when composer is disposed
  const originalDispose = composer.dispose.bind(composer);
  composer.dispose = () => {
    try {
      unsub();
    } catch {}

    originalDispose();
  };

  return composer;
}
