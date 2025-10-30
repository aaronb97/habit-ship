import * as THREE from 'three';
import { getCurrentDate } from '../time';
import { cBodies as PLANETS, Planet, Moon, type CBody, earth } from '../../planets';
import type { Coordinates } from '../../types';
import {
  KM_TO_SCENE,
  TRAIL_LENGTH_MULTIPLIER,
  ORBIT_OFFSET_MULTIPLIER,
  SIZE_EXPONENT,
  MIN_SCALE_RATIO,
} from './constants';
import { computeFriendSurfacePosAim, computeFriendTravelPosAim } from './paths';

export function toVec3([x, y, z]: Coordinates): THREE.Vector3 {
  return new THREE.Vector3(x * KM_TO_SCENE, y * KM_TO_SCENE, z * KM_TO_SCENE);
}

export function getTrailForBody(body: Planet | Moon, segments = 500): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const today = getCurrentDate();
  const periodDays = TRAIL_LENGTH_MULTIPLIER * body.orbitalPeriodDays;
  const stepDays = periodDays / Math.max(1, segments);
  const stepMs = stepDays * 24 * 60 * 60 * 1000;

  const drawOrbitAroundParent = body instanceof Moon;
  const parent = drawOrbitAroundParent
    ? PLANETS.find((b) => b.name === (body as Moon).orbits)
    : undefined;

  // Scale offsets so the ring matches the visually exaggerated separation applied in
  // adjustPositionForOrbits
  const multiplier =
    body instanceof Moon
      ? (body.orbitOffsetMultiplier ?? ORBIT_OFFSET_MULTIPLIER)
      : ORBIT_OFFSET_MULTIPLIER;

  if (drawOrbitAroundParent && parent && parent instanceof Planet) {
    // Anchor the moon's trail around the parent's CURRENT position,
    // using historical relative offsets (moon - parent) for each day.
    const parentAnchor = toVec3(parent.getPosition());

    for (let i = segments; i >= 1; i--) {
      const d = new Date(today.getTime() - i * stepMs);

      const childKm = body.getPosition(d);
      const parentKm = parent.getPosition(d);

      const offset = toVec3([
        (childKm[0] - parentKm[0]) * multiplier,
        (childKm[1] - parentKm[1]) * multiplier,
        (childKm[2] - parentKm[2]) * multiplier,
      ]);

      points.push(parentAnchor.clone().add(offset));
    }

    // Include today's point
    const childToday = body.getPosition(today);
    const parentToday = parent.getPosition(today);
    {
      const offset = toVec3([
        (childToday[0] - parentToday[0]) * multiplier,
        (childToday[1] - parentToday[1]) * multiplier,
        (childToday[2] - parentToday[2]) * multiplier,
      ]);

      points.push(parentAnchor.clone().add(offset));
    }

    return points;
  }

  // Default: heliocentric trail (for planets orbiting the Sun)
  for (let i = segments; i >= 1; i--) {
    const d = new Date(today.getTime() - i * stepMs);
    const coords = body.getPosition(d);
    points.push(
      new THREE.Vector3(coords[0] * KM_TO_SCENE, coords[1] * KM_TO_SCENE, coords[2] * KM_TO_SCENE),
    );
  }

  // Include today's point
  {
    const coords = body.getPosition(today);
    points.push(
      new THREE.Vector3(coords[0] * KM_TO_SCENE, coords[1] * KM_TO_SCENE, coords[2] * KM_TO_SCENE),
    );
  }

  return points;
}

export function apparentScaleRatio(ratio: number): number {
  // Prevent degenerate values; compress dynamic range using power law
  const r = Math.max(ratio, MIN_SCALE_RATIO);
  return Math.pow(r, SIZE_EXPONENT);
}

// If a body orbits a parent, push it outward along the parent->child direction
// to avoid visual overlap given our non-physical display radii.
export function adjustPositionForOrbits(body: CBody, basePosition: THREE.Vector3): THREE.Vector3 {
  if (body instanceof Moon) {
    const parent = PLANETS.find((b) => b.name === body.orbits);
    if (parent) {
      const parentPos = toVec3(parent.getPosition());
      const dir = basePosition.clone().sub(parentPos);

      return parentPos.add(
        dir.multiplyScalar(body.orbitOffsetMultiplier ?? ORBIT_OFFSET_MULTIPLIER),
      );
    }
  }

  return basePosition;
}

/**
 * Computes a friend's surface position and aim vector given start/target planet names.
 * Resolves planet centers and visual radii using the provided getter, then delegates to
 * computeFriendSurfacePosAim to apply tangent-plane spread and yaw offsets.
 *
 * Parameters:
 * - startName: Name of the start body.
 * - targetName: Name of the target body.
 * - getVisualRadius: Callback returning visual radius (scene units) for a body name.
 * - theta: Tangent-plane angle in radians for lateral spread around the start.
 * - yaw: Yaw offset in radians applied to the aim direction about the path axis.
 * - spreadAlpha: 0..1 lateral spread fraction relative to start body's visual radius.
 *
 * Returns: Object containing pos (surface position) and aim (look-at target).
 */
export function computeFriendSurfacePosAimByNames(
  startName: string,
  targetName: string,
  getVisualRadius: (name: string) => number,
  theta: number,
  yaw: number,
): { pos: THREE.Vector3; aim: THREE.Vector3 } {
  const startBody = PLANETS.find((b) => b.name === startName) ?? earth;
  const targetBody = PLANETS.find((b) => b.name === targetName) ?? earth;
  const startCenter = toVec3(startBody.getVisualPosition());
  const targetCenter = toVec3(targetBody.getVisualPosition());
  const startVisualRadius = getVisualRadius(startBody.name);
  const targetVisualRadius = getVisualRadius(targetBody.name);

  return computeFriendSurfacePosAim(
    startCenter,
    targetCenter,
    startVisualRadius,
    targetVisualRadius,
    theta,
    yaw,
  );
}

/**
 * Computes a friend's in-flight position and aim given start/target names
 * and a base centerline position.
 *
 * Parameters:
 * - startName: Name of the start body.
 * - targetName: Name of the target body.
 * - basePos: Centerline-interpolated position along the path.
 * - getVisualRadius: Callback returning visual radius (scene units) for a body name.
 * - theta: Tangent-plane angle in radians for lateral spread around the path.
 * - spreadAlpha: 0..1 lateral spread fraction relative to start body's visual radius.
 *
 * Returns: Object containing pos (offset from centerline) and aim (look-at target).
 */
export function computeFriendTravelPosAimByNames(
  startName: string,
  targetName: string,
  basePos: THREE.Vector3,
  getVisualRadius: (name: string) => number,
  theta: number,
): { pos: THREE.Vector3; aim: THREE.Vector3 } {
  const startBody = PLANETS.find((b) => b.name === startName) ?? earth;
  const targetBody = PLANETS.find((b) => b.name === targetName) ?? earth;
  const startCenter = toVec3(startBody.getVisualPosition());
  const targetCenter = toVec3(targetBody.getVisualPosition());
  const startVisualRadius = getVisualRadius(startBody.name);

  return computeFriendTravelPosAim(startCenter, targetCenter, basePos, startVisualRadius, theta);
}
