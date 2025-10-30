import * as THREE from 'three';
import { ROCKET_LANDING_CLEARANCE, ROCKET_LANDING_SPREAD_FRACTION } from './constants';

/**
 * Computes the surface-to-surface endpoints between a start and target body
 * along the line connecting their centers.
 *
 * Parameters:
 * - startCenter: Center of the start body in scene units.
 * - startVisualRadius: Displayed visual radius of the start body (scene units).
 * - targetCenter: Center of the target body in scene units.
 * - targetVisualRadius: Displayed visual radius of the target body (scene units).
 *
 * Returns: Object containing startSurface and targetSurface points in scene space.
 */
export function computeSurfaceEndpoints(
  startCenter: THREE.Vector3,
  startVisualRadius: number,
  targetCenter: THREE.Vector3,
  targetVisualRadius: number,
): { startSurface: THREE.Vector3; targetSurface: THREE.Vector3 } {
  const dir = targetCenter.clone().sub(startCenter);
  const dirLen = Math.max(1e-9, dir.length());
  const dirN = dir.clone().divideScalar(dirLen);

  const startSurface = startCenter.clone().add(dirN.clone().multiplyScalar(startVisualRadius));
  const targetSurface = targetCenter
    .clone()
    .sub(dirN.clone().multiplyScalar(targetVisualRadius + ROCKET_LANDING_CLEARANCE));

  return { startSurface, targetSurface };
}

/**
 * Computes an aim (look-at) position just in front of the target body surface
 * along the line from start to target.
 *
 * Parameters:
 * - startCenter: Center of the start body (scene units).
 * - targetCenter: Center of the target body (scene units).
 * - targetVisualRadius: Display radius of the target body (scene units).
 *
 * Returns: Scene-space point to aim toward, offset slightly from the target surface.
 */
export function computeAimPosition(
  startCenter: THREE.Vector3,
  targetCenter: THREE.Vector3,
  targetVisualRadius: number,
): THREE.Vector3 {
  const dir = targetCenter.clone().sub(startCenter);
  const dirN = dir.clone().normalize();
  return targetCenter
    .clone()
    .sub(dirN.clone().multiplyScalar(targetVisualRadius + ROCKET_LANDING_CLEARANCE));
}

/**
 * Computes a friend's surface position and aim vector on the start body using
 * a stable tangent basis around the start->target axis and a lateral spread.
 *
 * Parameters:
 * - startCenter: Start body center in scene units.
 * - targetCenter: Target body center in scene units.
 * - startVisualRadius: Start body visual radius (scene units).
 * - targetVisualRadius: Target body visual radius (scene units).
 * - theta: Tangent-plane angle in radians for lateral spread around the start.
 * - yaw: Yaw offset in radians applied to the aim direction about the path axis.
 * - spreadAlpha: 0..1 lateral spread fraction relative to startVisualRadius.
 *
 * Returns: Object containing pos (surface position) and aim (look-at target).
 */
export function computeFriendSurfacePosAim(
  startCenter: THREE.Vector3,
  targetCenter: THREE.Vector3,
  startVisualRadius: number,
  targetVisualRadius: number,
  theta: number,
  yaw: number,
): { pos: THREE.Vector3; aim: THREE.Vector3 } {
  const dirN = targetCenter.clone().sub(startCenter).normalize();
  const baseStartSurface = startCenter.clone().add(dirN.clone().multiplyScalar(startVisualRadius));
  const aimBase = computeAimPosition(startCenter, targetCenter, targetVisualRadius);
  const baseAimDir = aimBase.clone().sub(baseStartSurface);

  // Build a stable tangent basis around the path axis
  let helper = new THREE.Vector3(0, 0, 1);
  if (Math.abs(dirN.dot(helper)) > 0.98) {
    helper = new THREE.Vector3(1, 0, 0);
  }

  const r = dirN.clone().cross(helper).normalize();
  const u = r.clone().cross(dirN).normalize();

  const offsetDir = r
    .clone()
    .multiplyScalar(Math.cos(theta))
    .add(u.clone().multiplyScalar(Math.sin(theta)));

  const newDir = dirN
    .clone()
    .add(offsetDir.multiplyScalar(Math.max(0, ROCKET_LANDING_SPREAD_FRACTION)))
    .normalize();
  const pos = startCenter.clone().add(newDir.multiplyScalar(startVisualRadius));

  const aimDir = baseAimDir.clone().applyAxisAngle(dirN, yaw);
  const aim = pos.clone().add(aimDir);
  return { pos, aim };
}

/**
 * Computes a friend's in-flight position offset next to the centerline and
 * a matching aim direction so all rockets point consistently while traveling.
 *
 * Parameters:
 * - startCenter: Start body center (scene units).
 * - targetCenter: Target body center (scene units).
 * - basePos: Centerline interpolated position along the path.
 * - startVisualRadius: Start body visual radius (scene units).
 * - theta: Tangent-plane angle in radians for lateral spread around the path.
 * - spreadAlpha: 0..1 lateral spread fraction relative to startVisualRadius.
 *
 * Returns: Object containing pos (offset from centerline) and aim (look-at target).
 */
export function computeFriendTravelPosAim(
  startCenter: THREE.Vector3,
  targetCenter: THREE.Vector3,
  basePos: THREE.Vector3,
  startVisualRadius: number,
  theta: number,
): { pos: THREE.Vector3; aim: THREE.Vector3 } {
  const dir = targetCenter.clone().sub(startCenter);
  const dirN = dir.clone().normalize();

  let helper = new THREE.Vector3(0, 0, 1);
  if (Math.abs(dirN.dot(helper)) > 0.98) {
    helper = new THREE.Vector3(1, 0, 0);
  }

  const r = dirN.clone().cross(helper).normalize();
  const u = r.clone().cross(dirN).normalize();

  const lateralDir = r
    .clone()
    .multiplyScalar(Math.cos(theta))
    .add(u.clone().multiplyScalar(Math.sin(theta)));

  const lateralMag = Math.max(0, ROCKET_LANDING_SPREAD_FRACTION) * startVisualRadius;
  const pos = basePos.clone().add(lateralDir.multiplyScalar(lateralMag));

  // Keep everyone pointing along the path direction
  const aim = pos.clone().add(dirN);
  return { pos, aim };
}
