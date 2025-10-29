import * as THREE from 'three';
import { getCurrentDate } from '../../utils/time';
import { cBodies as PLANETS, Planet, Moon, type CBody } from '../../planets';
import type { Coordinates } from '../../types';
import {
  KM_TO_SCENE,
  TRAIL_LENGTH_MULTIPLIER,
  ORBIT_OFFSET_MULTIPLIER,
  SIZE_EXPONENT,
  MIN_SCALE_RATIO,
} from './constants';

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
