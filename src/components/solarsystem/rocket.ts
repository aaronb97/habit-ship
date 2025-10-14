import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Asset } from 'expo-asset';
import {
  DEFAULT_ROCKET_FORWARD,
  ROCKET_MODEL_SCALE,
  ROCKET_SPIN_SPEED,
  ROCKET_SURFACE_OFFSET,
  ROCKET_LANDING_CLEARANCE,
} from './constants';

/**
 * Loads the Rocket OBJ and applies the provided color as a Lambert material.
 * Returns the THREE.Group ready to add to the scene.
 */
export async function loadRocket(rocketColor: number): Promise<THREE.Group> {
  const rocketAsset = Asset.fromModule(
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('../../../assets/Rocket.obj'),
  );

  await rocketAsset.downloadAsync();
  const loader = new OBJLoader();
  const uri = rocketAsset.localUri ?? rocketAsset.uri;

  const obj: THREE.Group = await new Promise((resolve, reject) => {
    loader.load(uri, resolve, undefined, reject);
  });

  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mesh = child as THREE.Mesh;
      mesh.material = new THREE.MeshLambertMaterial({ color: rocketColor });
    }
  });

  obj.scale.setScalar(ROCKET_MODEL_SCALE);
  return obj;
}

/**
 * Computes the "aim" position near the target surface, offset along the inbound direction so
 * the rocket looks at a point just above the surface rather than the target center.
 */
export function computeAimPosition(
  startCenter: THREE.Vector3,
  targetCenter: THREE.Vector3,
  targetVisualRadius: number,
): THREE.Vector3 {
  const dir = targetCenter.clone().sub(startCenter);
  const dirN = dir.clone().normalize();
  const targetR = targetVisualRadius * (1 + ROCKET_SURFACE_OFFSET);
  return targetCenter
    .clone()
    .sub(dirN.clone().multiplyScalar(targetR + ROCKET_LANDING_CLEARANCE));
}

/**
 * Orients the rocket so its forward axis points toward aimPos and applies a spin around its
 * forward axis. Returns the updated spin angle to persist between frames.
 */
export function orientAndSpinRocket(
  rocket: THREE.Group,
  aimPos: THREE.Vector3,
  isTraveling: boolean,
  spinAngle: number,
): number {
  const dirToTarget = aimPos.clone().sub(rocket.position);
  if (dirToTarget.lengthSq() > 1e-12) {
    dirToTarget.normalize();
    const qLook = new THREE.Quaternion().setFromUnitVectors(
      DEFAULT_ROCKET_FORWARD,
      dirToTarget,
    );

    // Accumulate spin angle and apply twist around local forward using rotateOnAxis
    if (isTraveling) {
      spinAngle += ROCKET_SPIN_SPEED;
    } else {
      spinAngle *= 0.95;
    }

    rocket.quaternion.copy(qLook);
    rocket.rotateOnAxis(DEFAULT_ROCKET_FORWARD, spinAngle);
  }

  return spinAngle;
}
