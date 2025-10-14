import { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer, TextureLoader } from 'expo-three';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Asset } from 'expo-asset';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type {
  PinchGestureHandlerEventPayload,
  PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler';

import { colors } from '../styles/theme';
import {
  cBodies as PLANETS,
  Planet,
  Moon,
  earth,
  type CBody,
} from '../planets';
import { Coordinates } from '../types';
import { getCurrentDate, getCurrentTime } from '../utils/time';
import { isTraveling, useStore } from '../utils/store';
import { useIsFocused } from '@react-navigation/native';

// ==========================
// Constants — Easy Tweaking
// ==========================
// Units & scaling
// Scale real KM to scene units (keeps numbers in a reasonable range). 10,000,000 km => 1 scene unit.
const KM_TO_SCENE = 1 / 1e7;

// Trail rendering
// Maximum alpha (opacity) for the newest point in a trail.
const TRAIL_MAX_ALPHA = 0.85;
// Exponent for ease-in alpha ramp along trail (2 = quadratic ease-in).
const TRAIL_EASE_EXPONENT = 3;

// Apparent size scaling (for visual clarity vs physical accuracy)
// Base scaling factor for all celestial body radii on screen.
const CBODY_RADIUS_MULTIPLIER = 0.05;
// Nonlinear compression exponent to reduce giant/dwarf disparities relative to Earth.
const SIZE_EXPONENT = 0.6;
// Minimum ratio clamp to prevent degenerate sizes when numbers are tiny.
const MIN_SCALE_RATIO = 1e-6;

// Orbit layout
// Exaggerate separation of moons from their parent to avoid overlap with non-physical display radii.
const ORBIT_OFFSET_MULTIPLIER = 30;

// Camera and orbit behavior
// Max elevation angle away from the orbital plane (~63 degrees).
const MAX_PITCH_RAD = 1.1;
// Default camera radius (zoom) from the orbit center (user position).
const ORBIT_INITIAL_RADIUS = 0.2;
// Default yaw angle at start.
const ORBIT_INITIAL_YAW = 2;
// Initial height as a fraction of the radius; pitch starts at asin of this value.
const ORBIT_DEFAULT_HEIGHT_RATIO = 0.35;
// Idle autorotation speed (radians per frame) when user is not interacting.
const AUTO_ROTATE_YAW_SPEED = 0.001;
// Smoothing factors for tweening toward target yaw/pitch/radius.
const SMOOTHING_YAW = 0.15;
const SMOOTHING_PITCH = 0.18;
const SMOOTHING_RADIUS = 0.2;

// Gesture settings
// Min/max zoom radius for pinch gesture.
const ZOOM_MIN_RADIUS = 0.1;
const ZOOM_MAX_RADIUS = 20000;
// Drag across full screen width rotates yaw by 360°, across height rotates pitch by 180°.
const PAN_YAW_ROTATION_PER_FULL_DRAG = 2 * Math.PI;
const PAN_PITCH_ROTATION_PER_FULL_DRAG = Math.PI;
// Approximate frames per second used to convert gesture velocity (px/s) to per-frame values.
const INERTIA_FRAMES_PER_SECOND = 60;
// Clamp for inertial yaw/pitch velocity after pan end.
const YAW_VELOCITY_CLAMP = 0.2;
const PITCH_VELOCITY_CLAMP = 0.15;
// Friction factor applied to inertial velocities each frame.
const INERTIA_FRICTION = 0.92;
// Threshold below which inertial velocities are snapped to zero.
const INERTIA_STOP_EPSILON = 1e-6;

// Renderer & scene
// Clear color for the WebGL renderer.
const RENDERER_CLEAR_COLOR = 0x101018;
// Clear alpha for the renderer background.
const RENDERER_CLEAR_ALPHA = 1;
// Pixel ratio for the renderer (1 keeps things predictable across devices in GLView).
const RENDERER_PIXEL_RATIO = 1;
// MSAA samples for GLView; 0 disables to avoid unsupported configurations on some devices.
const GL_MSAA_SAMPLES = 0;
// Camera projection parameters.
const CAMERA_FOV = 60;
const CAMERA_NEAR = 0.05;
const CAMERA_FAR = 20000;

// Lighting
// Low ambient to keep space dark while detailing planet shading.
const AMBIENT_LIGHT_INTENSITY = 0.5;
// Sun light intensity, infinite distance (0) and mild decay for falloff.
const SUNLIGHT_INTENSITY = 5;
const SUNLIGHT_DISTANCE = 0;
const SUNLIGHT_DECAY = 0.1;

// Sky dome
// Radius and segments of the inverted sphere used as the starfield backdrop.
const SKY_SPHERE_RADIUS = 1800;
const SKY_SEGMENTS = 48;

// Geometry quality
// Number of segments used for planet spheres.
const SPHERE_SEGMENTS = 24;

// Material/texture knobs
// Anisotropic filtering for textures (improves sharpness at glancing angles).
const TEXTURE_ANISOTROPY = 4;

// Mesh orientation
// Rotate planet meshes so their equators are horizontal and textures align nicely.
const PLANET_MESH_X_ROTATION = -Math.PI / 2;
// (Removed continuous spin; we keep a static random phase.)

// Numerics
// Squared-length threshold to detect near-degenerate plane normals.
const PLANE_NORMAL_EPS = 1e-8;
// Threshold when choosing a helper axis for cross products (avoid near-parallel vectors).
const HELPER_AXIS_THRESHOLD = 0.9;
// Global ecliptic "up" direction (J2000 heliocentric ecliptic uses +Z as north)
const ECLIPTIC_UP = new THREE.Vector3(0, 0, 1);

// Post-processing outline
// Controls for the OutlinePass used to accent selected meshes.
const OUTLINE_EDGE_STRENGTH = 1.5;
const OUTLINE_EDGE_GLOW = 1.0;
const OUTLINE_EDGE_THICKNESS = 1.0;
const OUTLINE_PULSE_PERIOD = 0.0;

// Outline LOD & fading
// Fade outlines based on screen-space radius (in pixels). Below FADE_OUT -> 0, above FADE_IN -> 1.
const OUTLINE_MIN_PIXELS_FADE_OUT = 8; // start fading in around this size
const OUTLINE_MIN_PIXELS_FADE_IN = 14; // fully visible by this size
// Smoothing for outline intensity changes (per-frame lerp factor)
const OUTLINE_INTENSITY_SMOOTHING = 0.15;
// Below this intensity, disable the pass to avoid any processing cost
const OUTLINE_MIN_ENABLED_FACTOR = 0.02;

// Rocket model controls
const ROCKET_MODEL_SCALE = 0.01; // uniform scale for OBJ model
const ROCKET_SURFACE_OFFSET = 0.04; // extra offset above visual surface (fraction of visual radius)
const ROCKET_SPIN_SPEED = 0.03; // radians per frame while traveling
const DEFAULT_ROCKET_FORWARD = new THREE.Vector3(0, 1, 0); // assumed model forward axis
// Additional fixed clearance applied at destination to avoid intersecting surface (scene units)
const ROCKET_LANDING_CLEARANCE = 0.005;

const TRAIL_LENGTH_MULTIPLIER = 0.75;

function toVec3([x, y, z]: Coordinates): THREE.Vector3 {
  return new THREE.Vector3(x * KM_TO_SCENE, y * KM_TO_SCENE, z * KM_TO_SCENE);
}

function getTrailForBody(body: Planet | Moon, segments = 500): THREE.Vector3[] {
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
      ? body.orbitOffsetMultiplier ?? ORBIT_OFFSET_MULTIPLIER
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
      new THREE.Vector3(
        coords[0] * KM_TO_SCENE,
        coords[1] * KM_TO_SCENE,
        coords[2] * KM_TO_SCENE,
      ),
    );
  }

  // Include today's point
  {
    const coords = body.getPosition(today);
    points.push(
      new THREE.Vector3(
        coords[0] * KM_TO_SCENE,
        coords[1] * KM_TO_SCENE,
        coords[2] * KM_TO_SCENE,
      ),
    );
  }

  return points;
}

function apparentScaleRatio(ratio: number): number {
  // Prevent degenerate values; compress dynamic range using power law
  const r = Math.max(ratio, MIN_SCALE_RATIO);
  return Math.pow(r, SIZE_EXPONENT);
}

// If a body orbits a parent, push it outward along the parent->child direction
// to avoid visual overlap given our non-physical display radii.
function adjustPositionForOrbits(
  body: CBody,
  basePosition: THREE.Vector3,
): THREE.Vector3 {
  if (body instanceof Moon) {
    const parent = PLANETS.find((b) => b.name === body.orbits);
    if (parent) {
      const parentPos = toVec3(parent.getPosition());
      const dir = basePosition.clone().sub(parentPos);

      return parentPos.add(
        dir.multiplyScalar(
          body.orbitOffsetMultiplier ?? ORBIT_OFFSET_MULTIPLIER,
        ),
      );
    }
  }

  return basePosition;
}

// Map planet/star names to their texture assets in assets/cbodies
// We use require() so Metro bundles the images and Expo Asset can resolve to a local URI.
const BODY_TEXTURE_REQUIRE: Record<string, number> = {
  Sun: require('../../assets/cbodies/sun.jpg'),
  Earth: require('../../assets/cbodies/earth.jpg'),
  'The Moon': require('../../assets/cbodies/moon.jpg'),
  Mercury: require('../../assets/cbodies/mercury.jpg'),
  Venus: require('../../assets/cbodies/venus.jpg'),
  Mars: require('../../assets/cbodies/mars.jpg'),
  Jupiter: require('../../assets/cbodies/jupiter.jpg'),
  Saturn: require('../../assets/cbodies/saturn.jpg'),
  Uranus: require('../../assets/cbodies/uranus.jpg'),
  Neptune: require('../../assets/cbodies/neptune.jpg'),
  Pluto: require('../../assets/cbodies/pluto.jpg'),
  Io: require('../../assets/cbodies/io.jpg'),
  Europa: require('../../assets/cbodies/europa.jpg'),
  Ganymede: require('../../assets/cbodies/ganymede.jpg'),
  Callisto: require('../../assets/cbodies/callisto.jpg'),
  Titan: require('../../assets/cbodies/titan.jpg'),
  Iapetus: require('../../assets/cbodies/iapetus.jpg'),
  Triton: require('../../assets/cbodies/triton.png'),
};

async function loadBodyTextures(
  names: string[],
): Promise<Record<string, THREE.Texture>> {
  const textures: Record<string, THREE.Texture> = {};
  const loader = new TextureLoader();

  for (const name of names) {
    const req = BODY_TEXTURE_REQUIRE[name];
    if (!req) continue;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const asset = Asset.fromModule(req);
      await asset.downloadAsync();
      const tex = await loader.loadAsync(asset.localUri ?? asset.uri);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = TEXTURE_ANISOTROPY;
      textures[name] = tex;
    } catch (e) {
      console.warn(`[SolarSystemMap] Failed to load texture for ${name}`, e);
    }
  }

  return textures;
}

type MappedMaterial =
  | THREE.MeshBasicMaterial
  | THREE.MeshLambertMaterial
  | THREE.MeshPhongMaterial;

type PlanetMeshUserData = {
  visualRadius?: number;
};

function createPlanetMesh(
  name: string,
  color: number,
  radius: number,
  texture?: THREE.Texture,
): THREE.Mesh {
  const geom = new THREE.SphereGeometry(
    radius,
    SPHERE_SEGMENTS,
    SPHERE_SEGMENTS,
  );

  let mat: THREE.Material;

  if (texture) {
    if (name === 'Sun') {
      // Sun should appear self-lit
      mat = new THREE.MeshBasicMaterial({ map: texture });
    } else {
      // Use diffuse lighting so the day side is lit and night side is dark
      mat = new THREE.MeshLambertMaterial({ map: texture });
    }
  } else {
    // No texture: keep Sun self-lit, planets use Lambert for shading
    mat =
      name === 'Sun'
        ? new THREE.MeshBasicMaterial({ color })
        : new THREE.MeshLambertMaterial({ color });
  }

  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = name;
  mesh.rotation.x = PLANET_MESH_X_ROTATION;
  return mesh;
}

function createTrailLine(
  points: THREE.Vector3[],
  color: number,
): THREE.Line | undefined {
  if (points.length < 2) return undefined;
  const geom = new THREE.BufferGeometry().setFromPoints(points);

  // Build a per-vertex alpha attribute that fades from 0 (oldest)
  // to ~TRAIL_MAX_ALPHA (newest, closest to the body) to simulate motion.
  const n = points.length;
  const alphas = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 1; // 0 .. 1 from oldest to newest
    const eased = Math.pow(t, TRAIL_EASE_EXPONENT); // ease-in for smoother tail
    alphas[i] = TRAIL_MAX_ALPHA * eased; // 0 -> max alpha
  }

  geom.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));

  // Color as uniform; fragment shader uses per-vertex alpha.
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: `
      attribute float alpha;
      varying float vAlpha;
      void main() {
        vAlpha = alpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision mediump float;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(uColor, vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const line = new THREE.Line(geom, mat);
  return line;
}

export function SolarSystemMap() {
  const { width, height } = useWindowDimensions();

  // Refs for scene graph
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number | null>(null);
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const outlinePassesRef = useRef<Record<string, OutlinePass>>({});
  const outlineIntensityRef = useRef<Record<string, number>>({});
  const copyPassRef = useRef<ShaderPass | null>(null);

  const rocketRef = useRef<THREE.Group | null>(null);
  const planetRefs = useRef<Partial<Record<string, THREE.Mesh>>>({});
  const displayUserPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const trailRefs = useRef<Partial<Record<string, THREE.Line>>>({});
  const skyRef = useRef<THREE.Mesh | null>(null);

  const showTextures = useStore((s) => s.showTextures);

  const userPosState = useStore((s) => s.userPosition);

  const rocketColorFromStore = useStore((s) => s.rocketColor);
  const syncTravelVisuals = useStore((s) => s.syncTravelVisuals);
  const finalizeLandingAfterAnimation = useStore(
    (s) => s.finalizeLandingAfterAnimation,
  );

  const isFocusedValue = useIsFocused();
  const isFocusedRef = useRef<boolean>(isFocusedValue);
  useEffect(() => {
    isFocusedRef.current = isFocusedValue;
  }, [isFocusedValue]);

  useEffect(() => {
    return () => {
      console.log('SolarSystemMap unmounted');
    };
  }, []);

  // Determine which planet systems are relevant for rendering moons
  const getRelevantPlanetSystems = useCallback((): Set<string> => {
    const systems = new Set<string>();
    const { startingLocation, target } = useStore.getState().userPosition;

    const addSystemForName = (name: string | undefined) => {
      if (!name) return;
      const body = PLANETS.find((b) => b.name === name);
      if (!body) return;
      if (body instanceof Moon) {
        systems.add(body.orbits);
      } else if (body instanceof Planet) {
        systems.add(body.name);
      }
    };

    addSystemForName(startingLocation);
    addSystemForName(target?.name);

    return systems;
  }, []);

  // Animate between previous and current traveled distances per habit completion
  const HABIT_TRAVEL_ANIM_MS = 3000; // duration for visual travel per completion
  const CAMERA_MOVE_MS = 5000;
  const CAMERA_HOLD_MS = 1000; // then holds 1s before rocket anim begins

  // Helpers
  const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
  const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const lerpAngle = (a: number, b: number, t: number) => {
    let diff = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI; // shortest path
    if (diff < -Math.PI) diff += 2 * Math.PI;
    return a + diff * t;
  };

  const vantageForProgress = useCallback((p: number) => {
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
  }, []);

  // When focused, drive animation timing from focus start or latest distance change
  const focusAnimStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (isFocusedValue) {
      const start = getCurrentTime();
      focusAnimStartRef.current = start;
      // Ensure camera pre-roll has the correct endpoints when the user opens the Map
      cameraStartRef.current = {
        yaw: yawRef.current,
        pitch: pitchRef.current,
        radius: radiusRef.current,
      };

      const { initialDistance, previousDistanceTraveled, distanceTraveled } =
        useStore.getState().userPosition;

      const pending =
        useStore.getState().pendingTravelAnimation ||
        (typeof distanceTraveled === 'number' &&
          distanceTraveled !== previousDistanceTraveled);

      const denom =
        initialDistance && initialDistance > 0 ? initialDistance : 1;

      const fromAbs = Math.min(
        1,
        Math.max(0, (previousDistanceTraveled ?? 0) / denom),
      );

      const toAbs = Math.min(1, Math.max(0, (distanceTraveled ?? 0) / denom));
      vantageStartRef.current = vantageForProgress(fromAbs);
      vantageEndRef.current = vantageForProgress(toAbs);
      if (pending) {
        yawVelocityRef.current = 0;
        pitchVelocityRef.current = 0;
        radiusTargetRef.current = ORBIT_INITIAL_RADIUS;
        scheduleRef.current = {
          preRollEnd: start + CAMERA_MOVE_MS + CAMERA_HOLD_MS,
          rocketEnd:
            start + CAMERA_MOVE_MS + CAMERA_HOLD_MS + HABIT_TRAVEL_ANIM_MS,
        };

        scriptedCameraActiveRef.current = true;
      } else {
        scheduleRef.current = null;
        scriptedCameraActiveRef.current = false;
      }
    } else {
      focusAnimStartRef.current = null;
    }
  }, [isFocusedValue, vantageForProgress]);

  // Reset animation start when distance updates while focused
  const prevDistanceRef = useRef<{ prev?: number; curr?: number }>({});
  const distanceTraveledVal = userPosState.distanceTraveled;
  const previousDistanceTraveledVal = userPosState.previousDistanceTraveled;
  useEffect(() => {
    const changed =
      distanceTraveledVal !== prevDistanceRef.current.curr ||
      previousDistanceTraveledVal !== prevDistanceRef.current.prev;

    if (changed && isFocusedRef.current) {
      const start = getCurrentTime();
      focusAnimStartRef.current = start;
      // Capture camera state at animation start and desired vantage endpoints
      cameraStartRef.current = {
        yaw: yawRef.current,
        pitch: pitchRef.current,
        radius: radiusRef.current,
      };

      const { initialDistance } = useStore.getState().userPosition;
      const denom =
        initialDistance && initialDistance > 0 ? initialDistance : 1;

      const fromAbs = clamp01((previousDistanceTraveledVal ?? 0) / denom);
      const toAbs = clamp01((distanceTraveledVal ?? 0) / denom);
      vantageStartRef.current = vantageForProgress(fromAbs);
      vantageEndRef.current = vantageForProgress(toAbs);
      // Stop inertial motion and set zoom radius target for the move
      yawVelocityRef.current = 0;
      pitchVelocityRef.current = 0;
      radiusTargetRef.current = ORBIT_INITIAL_RADIUS;
      scheduleRef.current = {
        preRollEnd: start + CAMERA_MOVE_MS + CAMERA_HOLD_MS,
        rocketEnd:
          start + CAMERA_MOVE_MS + CAMERA_HOLD_MS + HABIT_TRAVEL_ANIM_MS,
      };

      scriptedCameraActiveRef.current = true;
    }

    // If values differ, an animation is pending; if equal, batch already synced
    animSyncedRef.current = previousDistanceTraveledVal === distanceTraveledVal;
    prevDistanceRef.current = {
      prev: previousDistanceTraveledVal,
      curr: distanceTraveledVal,
    };
  }, [distanceTraveledVal, previousDistanceTraveledVal, vantageForProgress]);

  const animAlphaRef = useRef(0);
  const animSyncedRef = useRef(true);
  const rocketSpinAngleRef = useRef(0);
  const cameraStartRef = useRef<{
    yaw: number;
    pitch: number;
    radius: number;
  } | null>(null);

  const vantageStartRef = useRef<{ yaw: number; pitch: number } | null>(null);
  const vantageEndRef = useRef<{ yaw: number; pitch: number } | null>(null);
  const scheduleRef = useRef<{ preRollEnd: number; rocketEnd: number } | null>(
    null,
  );

  const scriptedCameraActiveRef = useRef(false);

  // Helper: read visual radius (scene units) for a body
  const getVisualRadius = useCallback((name: string): number => {
    const mesh = planetRefs.current[name];
    if (!mesh) return 0;
    const ud = mesh.userData as PlanetMeshUserData;
    if (typeof ud.visualRadius === 'number')
      return ud.visualRadius * mesh.scale.x;
    const g = mesh.geometry as THREE.SphereGeometry;
    const r = g.parameters.radius;
    (mesh.userData as PlanetMeshUserData).visualRadius = r;
    return r * mesh.scale.x;
  }, []);

  const computeDisplayUserPos = useCallback((): THREE.Vector3 => {
    // If traveling, place user between start and target using distance proportion
    const {
      target,
      startingLocation,
      initialDistance,
      distanceTraveled,
      previousDistanceTraveled,
    } = useStore.getState().userPosition;

    if (target && typeof initialDistance === 'number' && initialDistance > 0) {
      const now = getCurrentTime();
      // If not focused, freeze at the starting point (alpha = 0)
      const effectiveStart =
        (isFocusedRef.current ? focusAnimStartRef.current : null) ?? now;

      const elapsed = Math.max(0, now - effectiveStart);
      const preRoll = CAMERA_MOVE_MS + CAMERA_HOLD_MS;
      const rocketAlpha = isFocusedRef.current
        ? elapsed <= preRoll
          ? 0
          : Math.min(1, (elapsed - preRoll) / HABIT_TRAVEL_ANIM_MS)
        : 0;

      animAlphaRef.current = rocketAlpha;
      const ease = easeInOutCubic(rocketAlpha);

      const from = previousDistanceTraveled ?? distanceTraveled ?? 0;
      const to = distanceTraveled ?? 0;
      const effectiveTraveled = Math.min(
        initialDistance,
        from + (to - from) * ease,
      );

      const t = Math.min(1, Math.max(0, effectiveTraveled / initialDistance));

      const startBody =
        PLANETS.find((b) => b.name === startingLocation) ?? earth;

      const targetBody = PLANETS.find((b) => b.name === target.name) ?? earth;

      const startCenter = adjustPositionForOrbits(
        startBody,
        toVec3(startBody.getPosition()),
      );

      const targetCenter = adjustPositionForOrbits(
        targetBody,
        toVec3(targetBody.getPosition()),
      );

      // Move between surfaces instead of centers for apparent distance
      const dir = targetCenter.clone().sub(startCenter);
      const dirLen = Math.max(1e-9, dir.length());
      const dirN = dir.clone().divideScalar(dirLen);
      const startR =
        getVisualRadius(startBody.name) * (1 + ROCKET_SURFACE_OFFSET);

      const targetR =
        getVisualRadius(targetBody.name) * (1 + ROCKET_SURFACE_OFFSET);

      const startSurface = startCenter
        .clone()
        .add(dirN.clone().multiplyScalar(startR));

      const targetSurface = targetCenter
        .clone()
        .sub(dirN.clone().multiplyScalar(targetR + ROCKET_LANDING_CLEARANCE));

      return startSurface.clone().lerp(targetSurface, t);
    }

    // Not traveling: snap to the current body's displayed position
    const body =
      PLANETS.find(
        (b) => b.name === useStore.getState().userPosition.startingLocation,
      ) ?? earth;

    const center = adjustPositionForOrbits(body, toVec3(body.getPosition()));
    const targetPos = useStore.getState().userPosition.target?.position;
    const tgtPos = toVec3(targetPos ?? earth.getPosition());
    const dir = tgtPos.clone().sub(center).normalize();
    const r = getVisualRadius(body.name) * (1 + ROCKET_SURFACE_OFFSET);
    return center.clone().add(dir.multiplyScalar(r || 0));
  }, [getVisualRadius]);

  // Simple orbit state (spherical coordinates around origin)
  const radiusRef = useRef(ORBIT_INITIAL_RADIUS);
  const radiusTargetRef = useRef(radiusRef.current);
  const yawRef = useRef(ORBIT_INITIAL_YAW); // phase angle for orbit within the plane
  // Elevation angle from the plane; default matches previous fixed height (~ORBIT_DEFAULT_HEIGHT_RATIO of radius)
  const pitchRef = useRef(Math.asin(ORBIT_DEFAULT_HEIGHT_RATIO));
  // Tweened camera orbit state
  const yawTargetRef = useRef(yawRef.current);
  const yawVelocityRef = useRef(0);
  const pitchTargetRef = useRef(pitchRef.current);
  const pitchVelocityRef = useRef(0);
  const isPanningRef = useRef(false);
  const lastPanXRef = useRef(0);
  const lastPanYRef = useRef(0);
  const pinchStartRadiusRef = useRef(0);

  const updateCamera = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    const r = radiusRef.current;
    const theta = yawRef.current; // orbit angle within the plane
    const phi = THREE.MathUtils.clamp(
      pitchRef.current,
      -MAX_PITCH_RAD,
      MAX_PITCH_RAD,
    );

    // Positions in scene units
    const sun = new THREE.Vector3(0, 0, 0);
    const user = rocketRef.current
      ? rocketRef.current.position.clone()
      : displayUserPosRef.current.clone();

    const targetPos = useStore.getState().userPosition.target?.position;
    const target = toVec3(targetPos ?? earth.getPosition());

    // Center of orbit: the user's position.
    const center = user.clone();

    // Plane normal defined by the three points (sun, user, target)
    const n = new THREE.Vector3();
    {
      const a = user.clone().sub(sun);
      const b = target.clone().sub(sun);
      n.copy(a.cross(b));
    }

    // Handle degeneracy (collinear or very small normal)
    if (n.lengthSq() < PLANE_NORMAL_EPS) {
      const a = user.clone().sub(sun);
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
    const rCos = r * Math.cos(phi);
    const rSin = r * Math.sin(phi);
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
  }, []);

  // Double-tap: smoothly zoom camera to default radius
  const zoomCamera = useCallback(() => {
    radiusTargetRef.current = ORBIT_INITIAL_RADIUS;

    // Stop inertial motion so reset feels snappy
    yawVelocityRef.current = 0;
    pitchVelocityRef.current = 0;
  }, []);

  // Gestures: pinch to zoom radius; pan to spin camera around the orbit plane

  const pinchGesture = useMemo(() => {
    return Gesture.Pinch()
      .onBegin(() => {
        pinchStartRadiusRef.current = radiusTargetRef.current;
        // User interaction cancels scripted camera for this sequence
        scriptedCameraActiveRef.current = false;
      })
      .onUpdate((e: PinchGestureHandlerEventPayload) => {
        const scale = e.scale; // 1 at start, >1 zoom out, <1 zoom in
        const newR = THREE.MathUtils.clamp(
          pinchStartRadiusRef.current / scale,
          ZOOM_MIN_RADIUS,
          ZOOM_MAX_RADIUS,
        );

        radiusTargetRef.current = newR;
      })
      .runOnJS(true);
  }, []);

  const panGesture = useMemo(() => {
    const RAD_PER_PX_X = PAN_YAW_ROTATION_PER_FULL_DRAG / Math.max(1, width);
    const RAD_PER_PX_Y = PAN_PITCH_ROTATION_PER_FULL_DRAG / Math.max(1, height);
    return Gesture.Pan()
      .onBegin(() => {
        isPanningRef.current = true;
        lastPanXRef.current = 0;
        lastPanYRef.current = 0;
        // User interaction cancels scripted camera for this sequence
        scriptedCameraActiveRef.current = false;
      })
      .onUpdate((e: PanGestureHandlerEventPayload) => {
        const dx = e.translationX - lastPanXRef.current;
        const dy = e.translationY - lastPanYRef.current;
        lastPanXRef.current = e.translationX;
        lastPanYRef.current = e.translationY;
        // Dragging right rotates clockwise (adjust sign as needed)
        yawTargetRef.current -= dx * RAD_PER_PX_X;
        // Dragging up (negative dy) now decreases elevation (inverted)
        pitchTargetRef.current = THREE.MathUtils.clamp(
          pitchTargetRef.current + dy * RAD_PER_PX_Y,
          -MAX_PITCH_RAD,
          MAX_PITCH_RAD,
        );
      })
      .onEnd((e) => {
        isPanningRef.current = false;
        lastPanXRef.current = 0;
        lastPanYRef.current = 0;
        // Add a bit of inertial spin, convert px/s -> rad/frame and clamp
        const pxPerFrameX = e.velocityX / INERTIA_FRAMES_PER_SECOND; // approx frames per second
        const initialYaw = -(pxPerFrameX * RAD_PER_PX_X);
        yawVelocityRef.current = THREE.MathUtils.clamp(
          initialYaw,
          -YAW_VELOCITY_CLAMP,
          YAW_VELOCITY_CLAMP,
        );

        const pxPerFrameY = e.velocityY / INERTIA_FRAMES_PER_SECOND;
        const initialPitch = pxPerFrameY * RAD_PER_PX_Y;
        pitchVelocityRef.current = THREE.MathUtils.clamp(
          initialPitch,
          -PITCH_VELOCITY_CLAMP,
          PITCH_VELOCITY_CLAMP,
        );
      })
      .onFinalize(() => {
        lastPanXRef.current = 0;
        lastPanYRef.current = 0;
      })
      .runOnJS(true);
  }, [width, height]);

  // Double-tap to reset camera
  const doubleTapGesture = useMemo(() => {
    return Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(250)
      .onEnd((_e, success) => {
        if (success) {
          zoomCamera();
        }
      })
      .runOnJS(true);
  }, [zoomCamera]);

  const composedGesture = useMemo(
    () => Gesture.Race(doubleTapGesture, pinchGesture, panGesture),
    [pinchGesture, panGesture, doubleTapGesture],
  );

  const onContextCreate = useCallback(
    async (gl: ExpoWebGLRenderingContext) => {
      glRef.current = gl;

      // Renderer
      const renderer = new Renderer({ gl });
      const { drawingBufferWidth, drawingBufferHeight } = gl;
      console.log(
        '[SolarSystemMap] onContextCreate',
        drawingBufferWidth,
        drawingBufferHeight,
      );

      renderer.setSize(drawingBufferWidth, drawingBufferHeight);
      renderer.setClearColor(RENDERER_CLEAR_COLOR, RENDERER_CLEAR_ALPHA);
      renderer.setPixelRatio(RENDERER_PIXEL_RATIO);
      rendererRef.current = renderer;

      // Scene & Camera
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(colors.background);
      sceneRef.current = scene;

      // Sky sphere: wrap the scene with a starfield texture
      try {
        const spaceAsset = Asset.fromModule(
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require('../../assets/cbodies/space.jpg'),
        );

        await spaceAsset.downloadAsync();

        const loader = new TextureLoader();
        const spaceTexture = await loader.loadAsync(
          spaceAsset.localUri ?? spaceAsset.uri,
        );

        // Ensure correct color space for sRGB textures
        spaceTexture.colorSpace = THREE.SRGBColorSpace;

        const skyGeometry = new THREE.SphereGeometry(
          SKY_SPHERE_RADIUS,
          SKY_SEGMENTS,
          SKY_SEGMENTS,
        );

        const skyMaterial = new THREE.MeshBasicMaterial({
          map: spaceTexture,
          side: THREE.BackSide,
          depthWrite: false,
        });

        const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
        skyRef.current = skyMesh;

        scene.add(skyMesh);
      } catch (e) {
        console.warn('[SolarSystemMap] Failed to load sky texture', e);
      }

      // Conditionally preload textures (initial setting only)
      const texturesByName = showTextures
        ? await loadBodyTextures(PLANETS.map((p) => p.name))
        : {};

      const camera = new THREE.PerspectiveCamera(
        CAMERA_FOV,
        drawingBufferWidth / drawingBufferHeight,
        CAMERA_NEAR,
        CAMERA_FAR,
      );

      cameraRef.current = camera;

      updateCamera();

      // Post-processing composer and base render pass
      const composer = new EffectComposer(renderer);
      composer.setSize(drawingBufferWidth, drawingBufferHeight);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);
      // We will always use a final Copy pass to render to screen to keep output consistent
      renderPass.renderToScreen = false;
      composerRef.current = composer;

      // Lights
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

      // Load Rocket OBJ and apply persistent color
      try {
        const rocketAsset = Asset.fromModule(
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require('../../assets/Rocket.obj'),
        );

        await rocketAsset.downloadAsync();
        const loader = new OBJLoader();
        const uri = rocketAsset.localUri ?? rocketAsset.uri;
        const obj: THREE.Group = await new Promise((resolve, reject) => {
          loader.load(uri, resolve, undefined, reject);
        });

        const rocketColor = rocketColorFromStore;

        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mesh = child as THREE.Mesh;
            mesh.material = new THREE.MeshLambertMaterial({
              color: rocketColor,
            });
          }
        });

        obj.scale.setScalar(ROCKET_MODEL_SCALE);
        rocketRef.current = obj;
        scene.add(obj);
      } catch (e) {
        console.warn(
          '[SolarSystemMap] Failed to load Rocket.obj, skipping model',
        );

        console.warn(e);
      }

      const relevantSystems = getRelevantPlanetSystems();

      PLANETS.forEach((p) => {
        // Scale each body's visual radius according to its real radius (km) relative to Earth,
        // apply an exponential clamp to compress extremes so giants shrink and dwarfs grow relatively.
        // Earth's displayed size remains unchanged. The Sun is kept modest for readability.
        const radius = Math.max(100, p.radiusKm);
        const ratioToEarth = radius / earth.radiusKm;
        const clampedRatio = apparentScaleRatio(ratioToEarth);
        const visualRadius = CBODY_RADIUS_MULTIPLIER * clampedRatio;

        const initialTexture = showTextures
          ? texturesByName[p.name]
          : undefined;

        const mesh = createPlanetMesh(
          p.name,
          p.color,
          visualRadius,
          initialTexture,
        );

        planetRefs.current[p.name] = mesh;
        // Store radius for screen-space calculations
        (mesh.userData as PlanetMeshUserData).visualRadius = visualRadius;
        // Apply base equatorial alignment and then axial tilt (deg -> rad)
        const tiltDeg = p.axialTiltDeg ?? 0;
        mesh.rotation.x = PLANET_MESH_X_ROTATION;
        if (tiltDeg !== 0) {
          mesh.rotation.z += THREE.MathUtils.degToRad(tiltDeg);
        }

        // Initialize a random rotation phase around the spin axis (local Y) and keep static.
        // Using rotateOnAxis ensures the rotation is about the local spin axis after tilt.
        const randomPhase = Math.random() * Math.PI * 2;
        mesh.rotateOnAxis(new THREE.Vector3(0, 1, 0), randomPhase);
        const basePos = toVec3(p.getPosition());
        const adjustedPos = adjustPositionForOrbits(p, basePos);
        mesh.position.copy(adjustedPos);
        // Only render moons for relevant systems on init
        if (p instanceof Moon) {
          const allowed = relevantSystems.has(p.orbits);
          mesh.visible = allowed;
        } else {
          mesh.visible = true;
        }

        scene.add(mesh);

        if (p instanceof Planet || p instanceof Moon) {
          if (useStore.getState().showTrails) {
            const trailPoints = getTrailForBody(p);
            const trail = createTrailLine(trailPoints, p.color);
            if (trail) {
              scene.add(trail);
              trailRefs.current[p.name] = trail;
              if (p instanceof Moon) {
                trail.visible = relevantSystems.has(p.orbits);
              }
            }
          }

          // Outline pass for this planet with its associated color
          if (composerRef.current) {
            const outlinePass = new OutlinePass(
              new THREE.Vector2(drawingBufferWidth, drawingBufferHeight),
              scene,
              camera,
              [mesh],
            );

            // Start disabled and at zero strength; we will fade in based on screen-space size
            outlinePass.edgeStrength = 0;
            outlinePass.edgeGlow = OUTLINE_EDGE_GLOW;
            outlinePass.edgeThickness = OUTLINE_EDGE_THICKNESS;
            outlinePass.pulsePeriod = OUTLINE_PULSE_PERIOD;
            outlinePass.visibleEdgeColor.set(p.color);
            outlinePass.hiddenEdgeColor.set(p.color);
            // Disabled until it meets the screen-space size threshold
            outlinePass.enabled = false;
            composerRef.current.addPass(outlinePass);
            outlinePassesRef.current[p.name] = outlinePass;
            outlineIntensityRef.current[p.name] = 0;
          }
        }
      });

      // Add a stable final copy pass that always renders to screen
      const copyPass = new ShaderPass(CopyShader);
      copyPass.renderToScreen = true;
      composer.addPass(copyPass);
      copyPassRef.current = copyPass;

      // Animation loop
      const renderLoop = () => {
        const { showTrails, logFPS } = useStore.getState();

        // No per-frame spin integration; positions only
        // Compute display user position for this frame
        displayUserPosRef.current = computeDisplayUserPos();

        // If focused and an animation batch is pending, mark it as seen once complete
        if (isFocusedRef.current && !animSyncedRef.current) {
          const { distanceTraveled, previousDistanceTraveled } =
            useStore.getState().userPosition;

          const complete =
            animAlphaRef.current >= 0.999 ||
            distanceTraveled === previousDistanceTraveled;

          if (complete) {
            try {
              syncTravelVisuals();
              // If a landing was reached by the last completion, finalize it now
              if (useStore.getState().pendingLanding) {
                finalizeLandingAfterAnimation();
              }
            } finally {
              animSyncedRef.current = true;
            }
          }
        }

        // Camera pre-roll and in-flight vantage update tied to absolute journey progress
        if (
          isFocusedRef.current &&
          scriptedCameraActiveRef.current &&
          !isPanningRef.current &&
          vantageStartRef.current &&
          focusAnimStartRef.current &&
          scheduleRef.current
        ) {
          const nowTs = getCurrentTime();
          const elapsed = Math.max(0, nowTs - focusAnimStartRef.current);
          const preRoll = CAMERA_MOVE_MS + CAMERA_HOLD_MS;
          const { rocketEnd } = scheduleRef.current;
          if (nowTs >= rocketEnd) {
            scriptedCameraActiveRef.current = false;
          } else if (elapsed < CAMERA_MOVE_MS && cameraStartRef.current) {
            const u = clamp01(elapsed / CAMERA_MOVE_MS);
            const start = cameraStartRef.current;
            const v0 = vantageStartRef.current;
            yawTargetRef.current = lerpAngle(start.yaw, v0.yaw, u);
            pitchTargetRef.current = lerp(start.pitch, v0.pitch, u);
            radiusTargetRef.current = ORBIT_INITIAL_RADIUS;
          } else if (elapsed < preRoll) {
            const v0 = vantageStartRef.current;
            yawTargetRef.current = v0.yaw;
            pitchTargetRef.current = v0.pitch;
            radiusTargetRef.current = ORBIT_INITIAL_RADIUS;
          } else {
            // During rocket animation, smoothly shift vantage toward the end vantage
            const v0 = vantageStartRef.current;
            const v1 = vantageEndRef.current ?? v0;
            const alpha = clamp01((elapsed - preRoll) / HABIT_TRAVEL_ANIM_MS);
            const e = easeInOutCubic(alpha);
            yawTargetRef.current = lerpAngle(v0.yaw, v1.yaw, e);
            pitchTargetRef.current = lerp(v0.pitch, v1.pitch, e);
            radiusTargetRef.current = ORBIT_INITIAL_RADIUS;
          }
        }

        // Update dynamic positions
        // 1) User rocket follows latest position and orientation
        if (rocketRef.current) {
          const rocket = rocketRef.current;
          rocket.position.copy(displayUserPosRef.current);

          // Determine aim target in scene units (prefer surface endpoint when traveling)
          const { target, startingLocation } = useStore.getState().userPosition;
          const startName = startingLocation;
          const targetName = target?.name ?? 'Earth';
          const startBody = PLANETS.find((b) => b.name === startName) ?? earth;
          const targetBody =
            PLANETS.find((b) => b.name === targetName) ?? earth;

          const startCenter = adjustPositionForOrbits(
            startBody,
            toVec3(startBody.getPosition()),
          );

          const targetCenter = adjustPositionForOrbits(
            targetBody,
            toVec3(targetBody.getPosition()),
          );

          const dir = targetCenter.clone().sub(startCenter);
          const dirN = dir.clone().normalize();
          const targetR =
            getVisualRadius(targetBody.name) * (1 + ROCKET_SURFACE_OFFSET);

          const aimPos = targetCenter
            .clone()
            .sub(
              dirN.clone().multiplyScalar(targetR + ROCKET_LANDING_CLEARANCE),
            );

          // Orient rocket so its forward axis points toward aim target
          const dirToTarget = aimPos.clone().sub(rocket.position);
          if (dirToTarget.lengthSq() > 1e-12) {
            dirToTarget.normalize();
            const qLook = new THREE.Quaternion().setFromUnitVectors(
              DEFAULT_ROCKET_FORWARD,
              dirToTarget,
            );

            // Accumulate spin angle and apply twist around local forward using rotateOnAxis
            if (isTraveling(useStore.getState())) {
              rocketSpinAngleRef.current += ROCKET_SPIN_SPEED;
            } else {
              rocketSpinAngleRef.current *= 0.95;
            }

            rocket.quaternion.copy(qLook);
            rocket.rotateOnAxis(
              DEFAULT_ROCKET_FORWARD,
              rocketSpinAngleRef.current,
            );
          }
        }

        // 2) Update planet positions (in case date offset changes)
        PLANETS.forEach((p) => {
          const mesh = planetRefs.current[p.name];
          if (mesh) {
            const basePos = toVec3(p.getPosition());
            const adjustedPos = adjustPositionForOrbits(p, basePos);
            mesh.position.copy(adjustedPos);
          }
        });

        // Update moon visibility based on current/target systems
        {
          const relevantSystemsNow = getRelevantPlanetSystems();
          PLANETS.forEach((p) => {
            const mesh = planetRefs.current[p.name];
            let line = trailRefs.current[p.name];
            if (p instanceof Moon) {
              const allowed = relevantSystemsNow.has(p.orbits);
              if (mesh) mesh.visible = allowed;
              // Ensure trail exists if trails are shown and moon allowed
              if (!line && showTrails && allowed) {
                const points = getTrailForBody(p);
                const created = createTrailLine(points, p.color);
                if (created) {
                  created.visible = true;
                  trailRefs.current[p.name] = created;
                  scene.add(created);
                  line = created;
                }
              }

              if (line) line.visible = allowed && showTrails;
            } else if (p instanceof Planet) {
              if (mesh) mesh.visible = true;
              if (!line && showTrails) {
                const points = getTrailForBody(p);
                const created = createTrailLine(points, p.color);
                if (created) {
                  created.visible = true;
                  trailRefs.current[p.name] = created;
                  scene.add(created);
                  line = created;
                }
              }

              if (line) line.visible = showTrails;
            } else {
              // e.g., Sun — no trails
              if (mesh) mesh.visible = true;
            }
          });
        }

        // Camera orbit: auto-rotate when idle, apply inertia, and tween toward targets
        if (
          !isPanningRef.current &&
          Math.abs(yawVelocityRef.current) < INERTIA_STOP_EPSILON
        ) {
          yawTargetRef.current += AUTO_ROTATE_YAW_SPEED;
        }

        // Apply inertial spin from pan end
        if (Math.abs(yawVelocityRef.current) > INERTIA_STOP_EPSILON) {
          yawTargetRef.current += yawVelocityRef.current;
          yawVelocityRef.current *= INERTIA_FRICTION; // friction
          if (Math.abs(yawVelocityRef.current) < INERTIA_STOP_EPSILON) {
            yawVelocityRef.current = 0;
          }
        }

        if (Math.abs(pitchVelocityRef.current) > INERTIA_STOP_EPSILON) {
          pitchTargetRef.current = THREE.MathUtils.clamp(
            pitchTargetRef.current + pitchVelocityRef.current,
            -MAX_PITCH_RAD,
            MAX_PITCH_RAD,
          );

          pitchVelocityRef.current *= INERTIA_FRICTION;
          if (Math.abs(pitchVelocityRef.current) < INERTIA_STOP_EPSILON) {
            pitchVelocityRef.current = 0;
          }
        }

        // Smoothly tween current yaw toward target yaw
        yawRef.current +=
          (yawTargetRef.current - yawRef.current) * SMOOTHING_YAW;

        // Smoothly tween current pitch toward target pitch
        pitchRef.current +=
          (pitchTargetRef.current - pitchRef.current) * SMOOTHING_PITCH;

        // Smoothly tween current radius toward target radius (zoom smoothing)
        radiusRef.current +=
          (radiusTargetRef.current - radiusRef.current) * SMOOTHING_RADIUS;

        updateCamera();

        // Keep sky centered on the camera to avoid parallax and clipping
        {
          const cam = cameraRef.current;
          const sky = skyRef.current;
          if (cam && sky) {
            sky.position.copy(cam.position);
          }
        }

        // Update outline visibility and fade based on apparent pixel radius
        {
          const cam = cameraRef.current;
          const glCtx = glRef.current;
          if (cam && glCtx) {
            const heightPx = glCtx.drawingBufferHeight;
            const vFovRad = (cam.fov * Math.PI) / 180;
            PLANETS.forEach((p) => {
              const mesh = planetRefs.current[p.name];
              const pass = outlinePassesRef.current[p.name];
              if (!mesh || !pass) return;
              // Skip outlines for invisible meshes
              if (!mesh.visible) {
                outlineIntensityRef.current[p.name] = 0;
                pass.enabled = false;
                return;
              }

              // Determine sphere radius in world units
              const ud = mesh.userData as PlanetMeshUserData;
              let r: number =
                typeof ud.visualRadius === 'number' ? ud.visualRadius : 0;
              if (r <= 0) {
                const g = mesh.geometry as THREE.SphereGeometry;
                r = g.parameters.radius;
                (mesh.userData as PlanetMeshUserData).visualRadius = r;
              }

              r *= mesh.scale.x;
              const d = cam.position.distanceTo(mesh.position);
              const heightWorld = 2 * d * Math.tan(vFovRad / 2);
              const px = (r / Math.max(1e-6, heightWorld)) * heightPx;
              const start = OUTLINE_MIN_PIXELS_FADE_OUT;
              const end = OUTLINE_MIN_PIXELS_FADE_IN;
              const target = THREE.MathUtils.clamp(
                (px - start) / (end - start),
                0,
                1,
              );

              const prev = outlineIntensityRef.current[p.name] ?? 0;
              const factor =
                prev + (target - prev) * OUTLINE_INTENSITY_SMOOTHING;

              outlineIntensityRef.current[p.name] = factor;
              pass.edgeStrength = OUTLINE_EDGE_STRENGTH * factor;
              pass.enabled = factor > OUTLINE_MIN_ENABLED_FACTOR;
            });
          }
        }

        if (isFocusedRef.current) {
          const frameStart = performance.now();
          if (composerRef.current) {
            composerRef.current.render();
          } else {
            renderer.render(scene, camera);
          }

          const elapsed = performance.now() - frameStart;
          const fps = 1000 / elapsed;
          if (logFPS) console.log(`FPS: ${fps.toFixed(2)}`);
        }

        gl.endFrameEXP();
        frameRef.current = requestAnimationFrame(renderLoop);
      };

      frameRef.current = requestAnimationFrame(renderLoop);
    },
    [
      showTextures,
      updateCamera,
      getRelevantPlanetSystems,
      rocketColorFromStore,
      computeDisplayUserPos,
      syncTravelVisuals,
      finalizeLandingAfterAnimation,
      getVisualRadius,
    ],
  );

  // Resize handling
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const gl = glRef.current;
    if (renderer && camera && gl) {
      const { drawingBufferWidth, drawingBufferHeight } = gl;
      renderer.setSize(drawingBufferWidth, drawingBufferHeight);
      camera.aspect = drawingBufferWidth / drawingBufferHeight;
      camera.updateProjectionMatrix();

      const composer = composerRef.current;
      if (composer) {
        composer.setSize(drawingBufferWidth, drawingBufferHeight);
      }

      // Update outline pass resolution so edges stay crisp on resize
      Object.values(outlinePassesRef.current).forEach((pass) => {
        pass.resolution.set(drawingBufferWidth, drawingBufferHeight);
      });
    }
  }, [width, height]);

  // Cleanup
  useEffect(() => {
    console.log('[SolarSystemMap] mounted');
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      const scene = sceneRef.current;
      if (scene) {
        scene.traverse((obj: THREE.Object3D) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => {
                const mm = m as MappedMaterial;
                if (mm.map) {
                  mm.map.dispose();
                }

                m.dispose();
              });
            } else {
              const mm = obj.material as MappedMaterial;
              if (mm.map) {
                mm.map.dispose();
              }

              (obj.material as THREE.Material).dispose();
            }
          } else if (obj instanceof THREE.Line) {
            obj.geometry.dispose();
            const mat = obj.material as THREE.Material;
            mat.dispose();
          }
        });
      }

      if (rendererRef.current) {
        // Dispose postprocessing passes and composer
        if (composerRef.current) {
          try {
            composerRef.current.dispose();
          } catch (e) {
            // ignore composer dispose errors
          }

          composerRef.current = null;
        }

        Object.values(outlinePassesRef.current).forEach((pass) => {
          try {
            pass.dispose();
          } catch (e) {
            // ignore outline pass dispose errors
          }
        });

        outlinePassesRef.current = {};

        rendererRef.current.dispose();
      }
    };
  }, []);

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={styles.container}>
        <GLView
          style={styles.gl}
          msaaSamples={GL_MSAA_SAMPLES}
          onContextCreate={onContextCreate}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    width: '100%',
    height: '100%',
    alignSelf: 'stretch',
  },
  gl: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
});
