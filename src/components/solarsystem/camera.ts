import * as THREE from 'three';
import { getCurrentTime } from '../../utils/time';
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

/**
 * Arguments provided to the collision resolver to compute a safe camera radius.
 * @param center The orbit center in scene space (user/display position).
 * @param target The aim target in scene space (defines orbit plane).
 * @param yaw The current yaw (radians) used to place the camera.
 * @param pitch The current pitch (radians) used to place the camera.
 * @param radius The current camera radius from center.
 * @param planeNormalOverride Optional forced orbit plane normal.
 * @param desiredPos The computed desired camera position for the current frame.
 * @returns The minimum safe radius to avoid clipping (>= radius).
 */
export type CameraCollisionResolver = (args: {
  center: THREE.Vector3;
  target: THREE.Vector3;
  yaw: number;
  pitch: number;
  radius: number;
  planeNormalOverride?: THREE.Vector3;
  desiredPos: THREE.Vector3;
}) => number;

export enum CameraPhase {
  Idle = 'Idle',
  AutoRotate = 'AutoRotate',
  PreRollMove = 'PreRollMove',
  Hold = 'Hold',
  RocketFollow = 'RocketFollow',
  Complete = 'Complete',
}

export type StageRadiusTarget = 'initial' | 'min' | number;
export type StagePitchTarget = 'max' | 'keep' | number;
export type DoubleTapStage = {
  matchRadius: StageRadiusTarget;
  epsilon?: number;
  action: 'reset' | 'set' | 'animate';
  radius?: StageRadiusTarget;
  pitch?: StagePitchTarget;
  durationMs?: number;
};

/**
 * Clamp a value to the [0,1] range.
 */
export function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

/**
 * Symmetric ease-in-out cubic curve for smooth animations.
 */
export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Linear interpolation between a and b by t in [0,1].
 */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Angle-aware interpolation that respects wrap-around across ±π.
 */
function lerpAngle(a: number, b: number, t: number) {
  let diff = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (diff < -Math.PI) {
    diff += 2 * Math.PI;
  }

  return a + diff * t;
}

/**
 * Map absolute journey progress [0,1] to a camera yaw/pitch vantage.
 */
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

/**
 * Place and orient the camera on an orbit around a center within the plane
 * defined by (sun, center, target). Keeps camera up aligned to the plane normal
 * and looks at the center to stabilize framing.
 *
 * When provided, planeNormalOverride forces the orbit plane normal (e.g.,
 * passing (0,1,0) will align the orbit plane to the scene's XZ plane).
 */
function updateOrbitCamera(
  camera: THREE.PerspectiveCamera,
  center: THREE.Vector3,
  target: THREE.Vector3,
  yaw: number,
  pitch: number,
  radius: number,
  planeNormalOverride?: THREE.Vector3,
) {
  // Positions in scene units
  const sun = new THREE.Vector3(0, 0, 0);

  const theta = yaw; // orbit angle within the plane
  const phi = THREE.MathUtils.clamp(pitch, -MAX_PITCH_RAD, MAX_PITCH_RAD);

  // Plane normal: either forced via override, or defined by the three points (sun, user, target)
  const n = new THREE.Vector3();
  if (
    planeNormalOverride &&
    planeNormalOverride.lengthSq() >= PLANE_NORMAL_EPS
  ) {
    n.copy(planeNormalOverride);
  } else {
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
    if (n.lengthSq() < PLANE_NORMAL_EPS) {
      n.set(0, 1, 0);
    }
  }

  // Normalize and enforce a consistent hemisphere so the view never flips.
  n.normalize();
  if (n.dot(ECLIPTIC_UP) > 0) {
    n.multiplyScalar(-1);
  }

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

// CameraController encapsulates camera orbit state, gesture interactions,
// scripted camera sequencing, and per-frame updates.
export class CameraController {
  public camera: THREE.PerspectiveCamera;

  // Current orbit state (spherical around the user/center)
  private yaw = ORBIT_INITIAL_YAW;
  private pitch = 0;
  public radius = ORBIT_INITIAL_RADIUS;

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

  private tweenActive = false;
  private tweenStartTs = 0;
  private tweenDurationMs = 0;
  private tweenStartRadius = 0;
  private tweenStartPitch = 0;
  private tweenEndRadius = 0;
  private tweenEndPitch = 0;

  // Optional: external callback to adjust radius to avoid geometry clipping
  private collisionResolver?: CameraCollisionResolver;

  // Scripted camera sequence (pre-roll -> hold -> rocket follow)
  private scriptedActive = false;
  private focusAnimStart?: number;
  private cameraStart?: CameraStart;
  private vantageStart?: Vantage;
  private vantageEnd?: Vantage;
  private _nowTs: number = 0;

  private doubleTapStages: DoubleTapStage[] = [
    {
      matchRadius: 'initial',
      epsilon: Math.max(0.01, ORBIT_INITIAL_RADIUS * 0.05),
      action: 'reset',
    },
    {
      matchRadius: 'min',
      epsilon: Math.max(0.01, ZOOM_MIN_RADIUS * 0.1),
      action: 'set',
      radius: 'min',
      pitch: 'keep',
    },
    {
      matchRadius: 60,
      epsilon: 1,
      action: 'animate',
      radius: 40,
      pitch: 0.5,
      durationMs: 1500,
    },
  ];

  /**
   * Create a controller for an orbit camera.
   * @param camera The THREE.PerspectiveCamera to control.
   */
  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  // ----- Public accessors -----
  /**
   * Current smoothed orbit state.
   * @returns The current yaw, pitch, and radius.
   */
  get state(): CameraState {
    return { yaw: this.yaw, pitch: this.pitch, radius: this.radius };
  }

  /**
   * Current tween targets being approached each frame.
   * @returns The target yaw, pitch, and radius.
   */
  get targets(): CameraState {
    return {
      yaw: this.yawTarget,
      pitch: this.pitchTarget,
      radius: this.radiusTarget,
    };
  }

  /**
   * Set or clear a collision resolver used to push the camera radius outward
   * when the line from center to camera would intersect scene geometry.
   * @param resolver Optional resolver; pass undefined to clear.
   */
  setCollisionResolver(resolver?: CameraCollisionResolver) {
    this.collisionResolver = resolver;
  }

  /**
   * Reset zoom to the initial radius and clear inertial motion.
   */
  resetZoom() {
    this.radiusTarget = ORBIT_INITIAL_RADIUS;
    // Make the reset feel snappy by stopping inertial motion
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
  }

  /**
   * Set a new radius target (clamped to bounds) and clear inertia.
   * @param r Desired orbit radius in scene units.
   */
  setRadiusTarget(r: number) {
    this.radiusTarget = THREE.MathUtils.clamp(
      r,
      ZOOM_MIN_RADIUS,
      ZOOM_MAX_RADIUS,
    );

    this.yawVelocity = 0;
    this.pitchVelocity = 0;
  }

  /**
   * Set a new pitch target (radians) and clear inertia.
   * @param p Pitch in radians.
   */
  setPitchTarget(p: number) {
    this.pitchTarget = THREE.MathUtils.clamp(p, -MAX_PITCH_RAD, MAX_PITCH_RAD);
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
  }

  /**
   * Cancel any active radius/pitch tween.
   */
  cancelTween() {
    this.tweenActive = false;
  }

  /**
   * Animate radius and pitch with easing over a duration. Cancels scripted camera.
   * @param radius Target orbit radius.
   * @param pitch Target pitch in radians.
   * @param durationMs Duration in milliseconds.
   */
  animateToRadiusAndPitch(radius: number, pitch: number, durationMs: number) {
    const r = THREE.MathUtils.clamp(radius, ZOOM_MIN_RADIUS, ZOOM_MAX_RADIUS);
    const p = THREE.MathUtils.clamp(pitch, -MAX_PITCH_RAD, MAX_PITCH_RAD);
    this.scriptedActive = false;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.tweenStartTs = getCurrentTime();
    this.tweenDurationMs = Math.max(1, durationMs);
    this.tweenStartRadius = this.radius;
    this.tweenStartPitch = this.pitch;
    this.tweenEndRadius = r;
    this.tweenEndPitch = p;
    this.tweenActive = true;
  }

  /**
   * Replace the double-tap stage sequence.
   * @param stages Ordered stages to cycle through.
   */
  configureDoubleTapStages(stages: DoubleTapStage[]) {
    this.doubleTapStages = stages.slice();
  }

  /**
   * Resolve a stage radius token to a numeric radius.
   */
  private resolveRadiusTarget(t: StageRadiusTarget): number {
    if (t === 'initial') {
      return ORBIT_INITIAL_RADIUS;
    }

    if (t === 'min') {
      return ZOOM_MIN_RADIUS;
    }

    return t;
  }

  /**
   * Resolve a stage pitch token to a numeric pitch.
   */
  private resolvePitchTarget(t: StagePitchTarget): number {
    if (t === 'max') {
      return MAX_PITCH_RAD;
    }

    if (t === 'keep') {
      return this.pitch;
    }

    return t;
  }

  /**
   * Determine an epsilon for matching a stage's radius.
   */
  private epsFor(target: StageRadiusTarget, provided?: number): number {
    if (typeof provided === 'number') {
      return provided;
    }

    if (target === 'initial') {
      return Math.max(0.01, ORBIT_INITIAL_RADIUS * 0.05);
    }

    if (target === 'min') {
      return Math.max(0.01, ZOOM_MIN_RADIUS * 0.1);
    }

    return 1.0;
  }

  /**
   * Approximately equal with tolerance.
   */
  private approxEq(a: number, b: number, eps: number) {
    return Math.abs(a - b) <= eps;
  }

  /**
   * Advance to the next configured double-tap stage.
   * Stops scripted/tweened motion before applying the next stage.
   */
  cycleDoubleTap() {
    this.stopScriptedCamera();
    this.cancelTween();

    const r = this.radius;
    let currentIndex = -1;
    for (let i = 0; i < this.doubleTapStages.length; i++) {
      const s = this.doubleTapStages[i];
      if (!s) {
        continue;
      }

      const matchR = this.resolveRadiusTarget(s.matchRadius);
      const eps = this.epsFor(s.matchRadius, s.epsilon);
      if (this.approxEq(r, matchR, eps)) {
        currentIndex = i;
        break;
      }
    }

    const nextIndex =
      currentIndex >= 0 ? (currentIndex + 1) % this.doubleTapStages.length : 0;

    const next = this.doubleTapStages[nextIndex];
    if (!next) {
      return;
    }

    if (next.action === 'reset') {
      this.resetZoom();
      return;
    }

    if (next.action === 'set') {
      const rr = this.resolveRadiusTarget(next.radius ?? 'initial');
      this.setRadiusTarget(rr);
      if (next.pitch !== undefined) {
        const pp = this.resolvePitchTarget(next.pitch);
        this.setPitchTarget(pp);
      }

      return;
    } else {
      const rr = this.resolveRadiusTarget(next.radius ?? 'initial');
      const pp = this.resolvePitchTarget(next.pitch ?? 'keep');
      const dur = Math.max(1, next.durationMs ?? 1);
      this.animateToRadiusAndPitch(rr, pp, dur);
      return;
    }
  }

  // ----- Gesture handling -----
  /**
   * Begin a pan gesture; cancels scripted/tween motion.
   */
  beginPan() {
    this.isPanning = true;
    // Any user interaction cancels scripted camera for this sequence
    this.scriptedActive = false;
    this.tweenActive = false;
  }

  /**
   * Update the pan gesture deltas.
   * @param dx Delta X in pixels since last update.
   * @param dy Delta Y in pixels since last update.
   * @param viewportWidth Current viewport width in pixels.
   * @param viewportHeight Current viewport height in pixels.
   */
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

  /**
   * End a pan gesture and seed inertial motion from velocity.
   * @param velocityX End velocity X in px/s.
   * @param velocityY End velocity Y in px/s.
   * @param viewportWidth Viewport width in px.
   * @param viewportHeight Viewport height in px.
   */
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

  /**
   * Begin a pinch gesture; cancels scripted/tween motion.
   */
  beginPinch() {
    this.pinchStartRadius = this.radiusTarget;
    // Any user interaction cancels scripted camera for this sequence
    this.scriptedActive = false;
    this.tweenActive = false;
  }

  /**
   * Update pinch scale to set a new radius target.
   * @param scale The gesture scale factor relative to begin (>= 0).
   */
  updatePinch(scale: number) {
    const newRadius = THREE.MathUtils.clamp(
      this.pinchStartRadius / Math.max(1e-6, scale),
      ZOOM_MIN_RADIUS,
      ZOOM_MAX_RADIUS,
    );

    this.radiusTarget = newRadius;
  }

  // ----- Scripted camera control -----

  /**
   * Start the scripted camera sequence from the given state and vantages.
   * Also resets inertia and sets the radius target for the move.
   * @param nowTs Current timestamp (ms) to anchor the sequence.
   * @param cameraStart The starting camera yaw/pitch/radius.
   * @param vantageStart The starting yaw/pitch vantage.
   * @param vantageEnd The ending yaw/pitch vantage.
   */
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

    this.scriptedActive = true;
    // Stop inertial motion and set zoom radius target for the move
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.radiusTarget = ORBIT_INITIAL_RADIUS;
  }

  /**
   * Convenience API: compute vantages from absolute journey progress and optionally
   * lock yaw to a side-on angle for the entire scripted sequence.
   * @param nowTs Anchor timestamp (ms).
   * @param cameraStart Starting camera state.
   * @param fromAbs Start progress in [0,1].
   * @param toAbs End progress in [0,1].
   * @param opts Optional yaw-lock settings.
   * Note: If fromAbs and toAbs are approximately equal, no scripted sequence is started.
   */
  startScriptedCameraFromProgress(
    nowTs: number,
    cameraStart: CameraStart,
    fromAbs: number,
    toAbs: number,
    opts?: { lockSideOnYaw?: boolean; sideYaw?: number },
  ) {
    // Avoid starting a redundant scripted sequence when progress hasn't changed.
    if (Math.abs(toAbs - fromAbs) <= 1e-6) {
      return;
    }

    const vStart = vantageForProgress(fromAbs);
    const vEnd = vantageForProgress(toAbs);
    const lock = opts?.lockSideOnYaw ?? false;
    const side = opts?.sideYaw ?? Math.PI / 2;

    const vStartAdj = lock ? { ...vStart, yaw: side } : vStart;
    const vEndAdj = lock ? { ...vEnd, yaw: side } : vEnd;
    this.startScriptedCamera(nowTs, cameraStart, vStartAdj, vEndAdj);
  }

  /**
   * Stop any active scripted camera sequence.
   */
  stopScriptedCamera() {
    this.scriptedActive = false;
  }

  /**
   * Compute the current camera phase.
   * - During scripted sequences, returns PreRollMove, Hold, RocketFollow, or Complete based on elapsed time.
   * - When not scripted, returns AutoRotate when background autorotation would apply; otherwise Idle.
   * @returns The current CameraPhase value.
   */
  public getCameraPhase(): CameraPhase {
    if (this.scriptedActive && this.focusAnimStart !== undefined) {
      const nowTs = this._nowTs || getCurrentTime();
      const elapsed = Math.max(0, nowTs - this.focusAnimStart);
      if (elapsed < CAMERA_MOVE_MS) {
        return CameraPhase.PreRollMove;
      }

      const preRoll = CAMERA_MOVE_MS + CAMERA_HOLD_MS;
      if (elapsed < preRoll) {
        return CameraPhase.Hold;
      }

      if (elapsed < preRoll + HABIT_TRAVEL_ANIM_MS) {
        return CameraPhase.RocketFollow;
      }

      return CameraPhase.Complete;
    }

    // Not in a scripted sequence: classify between Idle and AutoRotate.
    const hasUserMotion =
      this.isPanning ||
      Math.abs(this.yawVelocity) >= INERTIA_STOP_EPSILON ||
      Math.abs(this.pitchVelocity) >= INERTIA_STOP_EPSILON ||
      this.tweenActive;

    return hasUserMotion ? CameraPhase.Idle : CameraPhase.AutoRotate;
  }

  /**
   * Compute scripted yaw/pitch/radius targets for the current phase.
   */
  private computeScriptedCameraTargets(): {
    yawTarget: number;
    pitchTarget: number;
    radiusTarget: number;
  } {
    const nowTs = this._nowTs || getCurrentTime();
    const focusAnimStart = this.focusAnimStart!;
    const cameraStart = this.cameraStart!;
    const vantageStart = this.vantageStart!;
    const vantageEnd = this.vantageEnd ?? this.vantageStart!;

    const elapsed = Math.max(0, nowTs - focusAnimStart);
    const preRoll = CAMERA_MOVE_MS + CAMERA_HOLD_MS;
    // Compute the pre-roll ending yaw using the same wrap-aware logic as lerpAngle.
    // This preserves the multiple-of-π branch chosen during PreRollMove so we don't
    // snap back to the normalized principal angle during Hold or RocketFollow.
    const preRollYawEnd = lerpAngle(cameraStart.yaw, vantageStart.yaw, 1);

    const phase = this.getCameraPhase();
    if (phase === CameraPhase.PreRollMove) {
      const u = clamp01(elapsed / CAMERA_MOVE_MS);
      return {
        yawTarget: lerpAngle(cameraStart.yaw, vantageStart.yaw, u),
        // Keep pitch anchored at the starting value during pre-roll so initial load pitch stays at 0
        pitchTarget: cameraStart.pitch,
        radiusTarget: ORBIT_INITIAL_RADIUS,
      };
    }

    if (phase === CameraPhase.Hold) {
      return {
        // Ratchet to the same multiple-of-π branch we ended PreRoll on
        yawTarget: preRollYawEnd,
        // Continue holding the starting pitch value during the hold phase
        pitchTarget: cameraStart.pitch,
        radiusTarget: ORBIT_INITIAL_RADIUS,
      };
    }

    const alpha = clamp01((elapsed - preRoll) / HABIT_TRAVEL_ANIM_MS);
    const e = easeInOutCubic(alpha);

    return {
      // Preserve yaw continuity by starting from the preserved pre-roll yaw branch
      yawTarget: lerpAngle(preRollYawEnd, vantageEnd.yaw, e),
      // Keep pitch anchored at the starting value during rocket follow as well
      pitchTarget: cameraStart.pitch,
      radiusTarget: ORBIT_INITIAL_RADIUS,
    };
  }

  // ----- Per-frame update -----
  /**
   * Per-frame update: advances inertia/tweens, updates targets and applies the orbit transform.
   * @param center Scene-space center to orbit around (user/display position).
   * @param target Scene-space target to frame; defines the orbit plane normal.
   * @param planeNormalOverride Optional forced plane normal. When provided (e.g., (0,1,0)),
   * aligns the orbit plane accordingly regardless of center/target relationship.
   */
  tick(
    center: THREE.Vector3,
    target: THREE.Vector3,
    planeNormalOverride?: THREE.Vector3,
  ) {
    this._nowTs = getCurrentTime();

    const phase = this.getCameraPhase();
    // Update scripted camera targets if active
    if (
      this.scriptedActive &&
      this.focusAnimStart !== undefined &&
      this.cameraStart &&
      this.vantageStart
    ) {
      if (phase === CameraPhase.Complete) {
        this.scriptedActive = false;
      } else {
        const res = this.computeScriptedCameraTargets();
        this.yawTarget = res.yawTarget;
        // Do not modify pitch via scripted animation; user panning controls pitch exclusively
        this.radiusTarget = res.radiusTarget;
      }
    }

    // Auto-rotate when not panning and no significant yaw inertia

    if (phase === CameraPhase.AutoRotate) {
      this.yawTarget += AUTO_ROTATE_YAW_SPEED;
    }

    // Apply inertial spin from pan end
    if (Math.abs(this.yawVelocity) > INERTIA_STOP_EPSILON) {
      this.yawTarget += this.yawVelocity;
      this.yawVelocity *= INERTIA_FRICTION;
      if (Math.abs(this.yawVelocity) < INERTIA_STOP_EPSILON) {
        this.yawVelocity = 0;
      }
    }

    if (Math.abs(this.pitchVelocity) > INERTIA_STOP_EPSILON) {
      this.pitchTarget = THREE.MathUtils.clamp(
        this.pitchTarget + this.pitchVelocity,
        -MAX_PITCH_RAD,
        MAX_PITCH_RAD,
      );

      this.pitchVelocity *= INERTIA_FRICTION;
      if (Math.abs(this.pitchVelocity) < INERTIA_STOP_EPSILON) {
        this.pitchVelocity = 0;
      }
    }

    if (this.tweenActive) {
      const t = clamp01(
        (this._nowTs - this.tweenStartTs) / this.tweenDurationMs,
      );

      const e = easeInOutCubic(t);
      this.radius = lerp(this.tweenStartRadius, this.tweenEndRadius, e);
      this.pitch = lerp(this.tweenStartPitch, this.tweenEndPitch, e);
      this.radiusTarget = this.radius;
      this.pitchTarget = this.pitch;
      if (t >= 1) {
        this.tweenActive = false;
      }
    } else {
      this.yaw += (this.yawTarget - this.yaw) * SMOOTHING_YAW;
      this.pitch += (this.pitchTarget - this.pitch) * SMOOTHING_PITCH;
      this.radius += (this.radiusTarget - this.radius) * SMOOTHING_RADIUS;
    }

    // If a collision resolver is configured, compute desired position and
    // let it enforce a minimum safe radius for this frame (temporary push-out).
    let appliedRadius = this.radius;
    if (this.collisionResolver) {
      // Recompute the same orbit basis used by updateOrbitCamera to derive desiredPos
      const sun = new THREE.Vector3(0, 0, 0);
      const theta = this.yaw;
      const phi = THREE.MathUtils.clamp(this.pitch, -MAX_PITCH_RAD, MAX_PITCH_RAD);

      const n = new THREE.Vector3();
      if (planeNormalOverride && planeNormalOverride.lengthSq() >= PLANE_NORMAL_EPS) {
        n.copy(planeNormalOverride);
      } else {
        const a = center.clone().sub(sun);
        const b = target.clone().sub(sun);
        n.copy(a.cross(b));
      }

      if (n.lengthSq() < PLANE_NORMAL_EPS) {
        const a = center.clone().sub(sun);
        const helper =
          Math.abs(a.y) < HELPER_AXIS_THRESHOLD
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(1, 0, 0);

        n.copy(a.clone().cross(helper));
        if (n.lengthSq() < PLANE_NORMAL_EPS) {
          n.set(0, 1, 0);
        }
      }

      n.normalize();
      if (n.dot(ECLIPTIC_UP) > 0) {
        n.multiplyScalar(-1);
      }

      let U = target.clone().sub(center).projectOnPlane(n);
      if (U.lengthSq() < PLANE_NORMAL_EPS) {
        U = ECLIPTIC_UP.clone().cross(n);
        if (U.lengthSq() < PLANE_NORMAL_EPS) {
          const helper =
            Math.abs(n.y) < HELPER_AXIS_THRESHOLD
              ? new THREE.Vector3(0, 1, 0)
              : new THREE.Vector3(1, 0, 0);
          U = helper.clone().cross(n);
        }
      }

      U.normalize();
      const V = n.clone().cross(U).normalize();

      const rCos = this.radius * Math.cos(phi);
      const rSin = this.radius * Math.sin(phi);
      const circleOffset = U.clone()
        .multiplyScalar(Math.cos(theta) * rCos)
        .add(V.clone().multiplyScalar(Math.sin(theta) * rCos));
      const desiredPos = center
        .clone()
        .add(n.clone().multiplyScalar(rSin))
        .add(circleOffset);

      const safeRadius = this.collisionResolver({
        center,
        target,
        yaw: this.yaw,
        pitch: this.pitch,
        radius: this.radius,
        planeNormalOverride,
        desiredPos,
      });

      if (safeRadius > appliedRadius) {
        appliedRadius = safeRadius;
      }
    }

    // Apply transform to the camera
    updateOrbitCamera(
      this.camera,
      center,
      target,
      this.yaw,
      this.pitch,
      appliedRadius,
      planeNormalOverride,
    );
  }
}
