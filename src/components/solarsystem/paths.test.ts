import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import {
  computeSurfaceEndpoints,
  computeAimPosition,
  computeFriendSurfacePosAim,
  computeFriendTravelPosAim,
} from './paths';
import { ROCKET_LANDING_CLEARANCE } from './constants';

const eps = 1e-6;

function approx(a: number, b: number, e = eps) {
  return Math.abs(a - b) <= e;
}

describe('paths geometry helpers', () => {
  it('computeSurfaceEndpoints projects points to surfaces along the centerline', () => {
    const startCenter = new THREE.Vector3(0, 0, 0);
    const targetCenter = new THREE.Vector3(10, 0, 0);
    const startR = 1;
    const targetR = 2;

    const { startSurface, targetSurface } = computeSurfaceEndpoints(
      startCenter,
      startR,
      targetCenter,
      targetR,
    );

    expect(approx(startSurface.distanceTo(startCenter), startR)).toBe(true);
    const expectedTargetX = 10 - (targetR + ROCKET_LANDING_CLEARANCE);
    expect(approx(targetSurface.x, expectedTargetX)).toBe(true);
    expect(approx(targetSurface.y, 0)).toBe(true);
    expect(approx(targetSurface.z, 0)).toBe(true);
  });

  it('computeAimPosition returns a point just in front of target surface', () => {
    const s = new THREE.Vector3(0, 0, 0);
    const t = new THREE.Vector3(10, 0, 0);
    const rT = 2;
    const aim = computeAimPosition(s, t, rT);
    const expectedX = 10 - (rT + ROCKET_LANDING_CLEARANCE);
    expect(approx(aim.x, expectedX)).toBe(true);
    expect(approx(aim.y, 0)).toBe(true);
    expect(approx(aim.z, 0)).toBe(true);
  });

  it('computeFriendSurfacePosAim keeps pos on start surface and aims forward', () => {
    const s = new THREE.Vector3(0, 0, 0);
    const t = new THREE.Vector3(10, 0, 0);
    const rS = 1;
    const rT = 2;
    const theta = 0; // choose a stable lateral direction
    const yaw = 0; // no rotation around axis

    const { pos, aim } = computeFriendSurfacePosAim(s, t, rS, rT, theta, yaw);
    // Position stays on the start surface radius
    expect(approx(pos.distanceTo(s), rS)).toBe(true);
    // Aim vector generally points toward target (positive X component)
    const aimDir = aim.clone().sub(pos).normalize();
    expect(aimDir.x).toBeGreaterThan(0);
  });

  it('computeFriendTravelPosAim offsets base position laterally by spread*startRadius', () => {
    const s = new THREE.Vector3(0, 0, 0);
    const t = new THREE.Vector3(10, 0, 0);
    const base = new THREE.Vector3(5, 0, 0);
    const rS = 2;
    const theta = 0; // align with first lateral basis axis

    const { pos, aim } = computeFriendTravelPosAim(s, t, base, rS, theta);
    // Lateral offset magnitude equals spread*startRadius
    const lateralMag = 0.35 * rS;
    const offset = pos.clone().sub(base);
    expect(approx(offset.length(), lateralMag, 1e-5)).toBe(true);
    // Aim points generally along the path direction (positive X)
    const aimDir = aim.clone().sub(pos).normalize();
    expect(aimDir.x).toBeGreaterThan(0);
  });
});
