import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import type { Renderer } from 'expo-three';

export function createComposer(
  renderer: Renderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  size: THREE.Vector2,
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.setSize(size.x, size.y);

  const renderPass = new RenderPass(scene, camera);
  // Always render to composer, and have a final copy to screen for consistency
  renderPass.renderToScreen = false;
  composer.addPass(renderPass);

  const copyPass = new ShaderPass(CopyShader);
  copyPass.renderToScreen = true;
  composer.addPass(copyPass);

  return composer;
}
