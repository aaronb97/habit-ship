import * as THREE from 'three';
import {
  AMBIENT_LIGHT_INTENSITY,
  SUNLIGHT_INTENSITY,
  SUNLIGHT_DISTANCE,
  SUNLIGHT_DECAY,
} from './constants';

export function addDefaultLights(scene: THREE.Scene) {
  const ambient = new THREE.AmbientLight(0xffffff, AMBIENT_LIGHT_INTENSITY);
  scene.add(ambient);

  const sunLight = new THREE.PointLight(
    0xffffff,
    SUNLIGHT_INTENSITY,
    SUNLIGHT_DISTANCE,
    SUNLIGHT_DECAY,
  );
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  return { ambient, sunLight };
}
