import * as THREE from 'three';
import {
  MAX_PITCH_RAD,
  PLANE_NORMAL_EPS,
  HELPER_AXIS_THRESHOLD,
  ECLIPTIC_UP,
  ORBIT_INITIAL_RADIUS,
  ORBIT_INITIAL_YAW,
  CAMERA_MOVE_MS,
  CAMERA_HOLD_MS,
  HABIT_TRAVEL_ANIM_MS,
  AUTO_ROTATE_YAW_SPEED,
  SMOOTHING_YAW,
  SMOOTHING_PITCH,
  SMOOTHING_RADIUS,
  ZOOM_MIN_RADIUS,
  ZOOM_MAX_RADIUS,
  PAN_YAW_ROTATION_PER_FULL_DRAG,
  PAN_PITCH_ROTATION_PER_FULL_DRAG,
  INERTIA_FRAMES_PER_SECOND,
  YAW_VELOCITY_CLAMP,
  PITCH_VELOCITY_CLAMP,
  INERTIA_FRICTION,
  INERTIA_STOP_EPSILON,
} from './constants';

export type CameraState = {
  yaw: number;
  pitch: number;
  radius: number;
};

export type Vantage = { yaw: number; pitch: number };

export type CameraStart = CameraState;

export type ScriptSchedule = { preRollEnd: number; rocketEnd: number };

// eslint-disable-next-line no-shadow
export enum CameraPhase {
  Idle = 'Idle',
  PreRollMove = 'PreRollMove',
  Hold = 'Hold',
  RocketFollow = 'RocketFollow',
  Complete = 'Complete',
}

export function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function lerpAngle(a: number, b: number, t: number) {
  let diff = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  return a + diff * t;
}

export function vantageForProgress(p: number): Vantage {
  // Map absolute journey progress to camera yaw/pitch
  const PITCH_HIGH = MAX_PITCH_RAD * 0.95; // almost straight-down
  const PITCH_LOW = 0.06; // near-plane
  const YAW_AHEAD = 0; // in direction of travel
  const YAW_SIDE = Math.PI / 2; // side-on
  const YAW_BEHIND = Math.PI; // behind rocket
  const s = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / Math.max(1e-9, e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const yaw =
    p <= 0.5
      ? l(YAW_AHEAD, YAW_SIDE, s(0.0, 0.5, p))
      : l(YAW_SIDE, YAW_BEHIND, s(0.5, 1.0, p));

  const pitch = l(PITCH_HIGH, PITCH_LOW, s(0.1, 0.9, p));
  return { yaw, pitch };
}

export function updateOrbitCamera(
  camera: THREE.PerspectiveCamera,
  center: THREE.Vector3,
  target: THREE.Vector3,
  yaw: number,
  pitch: number,
  radius: number,
) {
  // Positions in scene units
  const sun = new THREE.Vector3(0, 0, 0);

  const theta = yaw; // orbit angle within the plane
  const phi = THREE.MathUtils.clamp(pitch, -MAX_PITCH_RAD, MAX_PITCH_RAD);

  // Plane normal defined by the three points (sun, user, target)
  const n = new THREE.Vector3();
  {
    const a = center.clone().sub(sun);
    const b = target.clone().sub(sun);
    n.copy(a.cross(b));
  }

  // Handle degeneracy (collinear or very small normal)
  if (n.lengthSq() < PLANE_NORMAL_EPS) {
    const a = center.clone().sub(sun);
    const helper =
      Math.abs(a.y) < HELPER_AXIS_THRESHOLD
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);

    n.copy(a.clone().cross(helper));
    if (n.lengthSq() < PLANE_NORMAL_EPS) n.set(0, 1, 0);
  }

  // Normalize and enforce a consistent hemisphere so the view never flips.
  n.normalize();
  if (n.dot(ECLIPTIC_UP) > 0) n.multiplyScalar(-1);

  // Orthonormal basis (U, V) spanning the plane with a stable orientation.
  // Start from the target direction projected into the plane. If degenerate, use
  // a stable reference (ECLIPTIC_UP x n) instead of arbitrary axes.
  let U = target.clone().sub(center).projectOnPlane(n);
  if (U.lengthSq() < PLANE_NORMAL_EPS) {
    U = ECLIPTIC_UP.clone().cross(n);
    if (U.lengthSq() < PLANE_NORMAL_EPS) {
      // Fallback if n is nearly aligned with ECLIPTIC_UP
      const helper =
        Math.abs(n.y) < HELPER_AXIS_THRESHOLD
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0);
      U = helper.clone().cross(n);
    }
  }

  U.normalize();
  const V = n.clone().cross(U).normalize();

  // Spherical placement: radius r from center, yaw around (U,V) plane by theta,
  // elevation from plane by phi along normal n.
  const rCos = radius * Math.cos(phi);
  const rSin = radius * Math.sin(phi);
  const circleOffset = U.clone()
    .multiplyScalar(Math.cos(theta) * rCos)
    .add(V.clone().multiplyScalar(Math.sin(theta) * rCos));

  const desiredPos = center
    .clone()
    .add(n.clone().multiplyScalar(rSin))
    .add(circleOffset);

  camera.position.copy(desiredPos);
  // Keep camera "up" aligned to the (sign-stabilized) plane normal to minimize roll
  camera.up.copy(n);

  // Look at the center of the plane to keep sun, user, and target framed
  camera.lookAt(center);
}

export function computeScriptedCameraTargets(params: {
  nowTs: number;
  focusAnimStart: number;
  cameraStart: CameraStart;
  vantageStart: Vantage;
  vantageEnd: Vantage;
}): {
  phase: CameraPhase;
  yawTarget: number;
  pitchTarget: number;
  radiusTarget: number;
} {
  const { nowTs, focusAnimStart, cameraStart, vantageStart, vantageEnd } =
    params;
  console.log({ vantageStart, vantageEnd });
  const elapsed = Math.max(0, nowTs - focusAnimStart);
  const preRoll = CAMERA_MOVE_MS + CAMERA_HOLD_MS;

  if (elapsed < CAMERA_MOVE_MS) {
    const u = clamp01(elapsed / CAMERA_MOVE_MS);
    return {
      phase: CameraPhase.PreRollMove,
      yawTarget: lerpAngle(cameraStart.yaw, vantageStart.yaw, u),
      // Keep pitch anchored at the starting value during pre-roll so initial load pitch stays at 0
      pitchTarget: cameraStart.pitch,
      radiusTarget: ORBIT_INITIAL_RADIUS,
    };
  }

  if (elapsed < preRoll) {
    return {
      phase: CameraPhase.Hold,
      yawTarget: vantageStart.yaw,
      // Continue holding the starting pitch value during the hold phase
      pitchTarget: cameraStart.pitch,
      radiusTarget: ORBIT_INITIAL_RADIUS,
    };
  }

  const alpha = clamp01((elapsed - preRoll) / HABIT_TRAVEL_ANIM_MS);
  const e = easeInOutCubic(alpha);
  return {
    phase: CameraPhase.RocketFollow,
    yawTarget: lerpAngle(vantageStart.yaw, vantageEnd.yaw, e),
    // Keep pitch anchored at the starting value during rocket follow as well
    pitchTarget: cameraStart.pitch,
    radiusTarget: ORBIT_INITIAL_RADIUS,
  };
}

// CameraController encapsulates camera orbit state, gesture interactions,
// scripted camera sequencing, and per-frame updates.
export class CameraController {
  private camera: THREE.PerspectiveCamera;

  // Current orbit state (spherical around the user/center)
  private yaw = ORBIT_INITIAL_YAW;
  private pitch = 0;
  private radius = ORBIT_INITIAL_RADIUS;

  // Targets we tween toward each frame
  private yawTarget = this.yaw;
  private pitchTarget = this.pitch;
  private radiusTarget = this.radius;

  // Pan inertia
  private yawVelocity = 0;
  private pitchVelocity = 0;

  // Interaction flags/state
  private isPanning = false;
  private pinchStartRadius = 0;

  // Scripted camera sequence (pre-roll -> hold -> rocket follow)
  private scriptedActive = false;
  private focusAnimStart?: number;
  private cameraStart?: CameraStart;
  private vantageStart?: Vantage;
  private vantageEnd?: Vantage;
  private schedule?: ScriptSchedule;
  private _lastPhase: CameraPhase = CameraPhase.Idle;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  // ----- Public accessors -----
  get state(): CameraState {
    return { yaw: this.yaw, pitch: this.pitch, radius: this.radius };
  }

  get targets(): CameraState {
    return {
      yaw: this.yawTarget,
      pitch: this.pitchTarget,
      radius: this.radiusTarget,
    };
  }

  get lastPhase(): CameraPhase {
    return this._lastPhase;
  }

  setOrbit(yaw?: number, pitch?: number, radius?: number) {
    if (typeof yaw === 'number') this.yaw = yaw;
    if (typeof pitch === 'number')
      this.pitch = THREE.MathUtils.clamp(pitch, -MAX_PITCH_RAD, MAX_PITCH_RAD);
    if (typeof radius === 'number') this.radius = radius;

    // Keep targets in sync when directly setting state
    if (typeof yaw === 'number') this.yawTarget = yaw;
    if (typeof pitch === 'number') this.pitchTarget = this.pitch;
    if (typeof radius === 'number') this.radiusTarget = radius;
  }

  setTargets(yaw?: number, pitch?: number, radius?: number) {
    if (typeof yaw === 'number') this.yawTarget = yaw;
    if (typeof pitch === 'number')
      this.pitchTarget = THREE.MathUtils.clamp(
        pitch,
        -MAX_PITCH_RAD,
        MAX_PITCH_RAD,
      );
    if (typeof radius === 'number')
      this.radiusTarget = THREE.MathUtils.clamp(
        radius,
        ZOOM_MIN_RADIUS,
        ZOOM_MAX_RADIUS,
      );
  }

  resetZoom() {
    this.radiusTarget = ORBIT_INITIAL_RADIUS;
    // Make the reset feel snappy by stopping inertial motion
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
  }

  // ----- Gesture handling -----
  beginPan() {
    this.isPanning = true;
    // Any user interaction cancels scripted camera for this sequence
    this.scriptedActive = false;
  }

  updatePan(
    dx: number,
    dy: number,
    viewportWidth: number,
    viewportHeight: number,
  ) {
    const RAD_PER_PX_X =
      PAN_YAW_ROTATION_PER_FULL_DRAG / Math.max(1, viewportWidth);
    const RAD_PER_PX_Y =
      PAN_PITCH_ROTATION_PER_FULL_DRAG / Math.max(1, viewportHeight);

    this.yawTarget -= dx * RAD_PER_PX_X;
    this.pitchTarget = THREE.MathUtils.clamp(
      this.pitchTarget + dy * RAD_PER_PX_Y,
      -MAX_PITCH_RAD,
      MAX_PITCH_RAD,
    );
  }

  endPan(
    velocityX: number,
    velocityY: number,
    viewportWidth: number,
    viewportHeight: number,
  ) {
    this.isPanning = false;
    const RAD_PER_PX_X =
      PAN_YAW_ROTATION_PER_FULL_DRAG / Math.max(1, viewportWidth);
    const RAD_PER_PX_Y =
      PAN_PITCH_ROTATION_PER_FULL_DRAG / Math.max(1, viewportHeight);

    const pxPerFrameX = velocityX / INERTIA_FRAMES_PER_SECOND;
    const initialYaw = -(pxPerFrameX * RAD_PER_PX_X);
    this.yawVelocity = THREE.MathUtils.clamp(
      initialYaw,
      -YAW_VELOCITY_CLAMP,
      YAW_VELOCITY_CLAMP,
    );

    const pxPerFrameY = velocityY / INERTIA_FRAMES_PER_SECOND;
    const initialPitch = pxPerFrameY * RAD_PER_PX_Y;
    this.pitchVelocity = THREE.MathUtils.clamp(
      initialPitch,
      -PITCH_VELOCITY_CLAMP,
      PITCH_VELOCITY_CLAMP,
    );
  }

  beginPinch() {
    this.pinchStartRadius = this.radiusTarget;
    // Any user interaction cancels scripted camera for this sequence
    this.scriptedActive = false;
  }

  updatePinch(scale: number) {
    const newRadius = THREE.MathUtils.clamp(
      this.pinchStartRadius / Math.max(1e-6, scale),
      ZOOM_MIN_RADIUS,
      ZOOM_MAX_RADIUS,
    );
    this.radiusTarget = newRadius;
  }

  // ----- Scripted camera control -----
  startScriptedCamera(
    nowTs: number,
    cameraStart: CameraStart,
    vantageStart: Vantage,
    vantageEnd: Vantage,
  ) {
    this.focusAnimStart = nowTs;
    this.cameraStart = cameraStart;
    this.vantageStart = vantageStart;
    this.vantageEnd = vantageEnd;
    this.schedule = {
      preRollEnd: nowTs + CAMERA_MOVE_MS + CAMERA_HOLD_MS,
      rocketEnd: nowTs + CAMERA_MOVE_MS + CAMERA_HOLD_MS + HABIT_TRAVEL_ANIM_MS,
    };

    this.scriptedActive = true;
    // Stop inertial motion and set zoom radius target for the move
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.radiusTarget = ORBIT_INITIAL_RADIUS;
  }

  stopScriptedCamera() {
    this.scriptedActive = false;
    this.schedule = undefined;
  }

  // ----- Per-frame update -----
  tick(
    center: THREE.Vector3,
    target: THREE.Vector3,
    opts?: { autoRotate?: boolean; nowTs?: number },
  ) {
    const autoRotate = opts?.autoRotate ?? true;
    const nowTs = opts?.nowTs ?? Date.now();

    // Update scripted camera targets if active
    if (
      this.scriptedActive &&
      this.focusAnimStart !== undefined &&
      this.schedule &&
      this.cameraStart &&
      this.vantageStart
    ) {
      const { rocketEnd } = this.schedule;
      if (nowTs >= rocketEnd) {
        this.scriptedActive = false;
      } else {
        const res = computeScriptedCameraTargets({
          nowTs,
          focusAnimStart: this.focusAnimStart,
          cameraStart: this.cameraStart,
          vantageStart: this.vantageStart,
          vantageEnd: this.vantageEnd ?? this.vantageStart,
        });
        this._lastPhase = res.phase;
        this.yawTarget = res.yawTarget;
        // Do not modify pitch via scripted animation; user panning controls pitch exclusively
        this.radiusTarget = res.radiusTarget;
      }
    }

    // Auto-rotate when not panning and no significant yaw inertia
    if (
      !this.isPanning &&
      Math.abs(this.yawVelocity) < INERTIA_STOP_EPSILON &&
      autoRotate
    ) {
      this.yawTarget += AUTO_ROTATE_YAW_SPEED;
    }

    // Apply inertial spin from pan end
    if (Math.abs(this.yawVelocity) > INERTIA_STOP_EPSILON) {
      this.yawTarget += this.yawVelocity;
      this.yawVelocity *= INERTIA_FRICTION;
      if (Math.abs(this.yawVelocity) < INERTIA_STOP_EPSILON)
        this.yawVelocity = 0;
    }

    if (Math.abs(this.pitchVelocity) > INERTIA_STOP_EPSILON) {
      this.pitchTarget = THREE.MathUtils.clamp(
        this.pitchTarget + this.pitchVelocity,
        -MAX_PITCH_RAD,
        MAX_PITCH_RAD,
      );
      this.pitchVelocity *= INERTIA_FRICTION;
      if (Math.abs(this.pitchVelocity) < INERTIA_STOP_EPSILON)
        this.pitchVelocity = 0;
    }

    // Smoothly tween current state toward targets
    this.yaw += (this.yawTarget - this.yaw) * SMOOTHING_YAW;
    this.pitch += (this.pitchTarget - this.pitch) * SMOOTHING_PITCH;
    this.radius += (this.radiusTarget - this.radius) * SMOOTHING_RADIUS;

    // Apply transform to the camera
    updateOrbitCamera(
      this.camera,
      center,
      target,
      this.yaw,
      this.pitch,
      this.radius,
    );
  }
}
