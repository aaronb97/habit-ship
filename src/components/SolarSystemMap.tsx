import { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
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
import { cBodies as PLANETS, Planet, Moon, earth } from '../planets';
import { getCurrentTime } from '../utils/time';
import { isTraveling, useStore } from '../utils/store';
import { useIsFocused } from '@react-navigation/native';

// Modularized helpers/builders
import {
  toVec3,
  getTrailForBody,
  apparentScaleRatio,
  adjustPositionForOrbits,
} from './solarsystem/helpers';
import {
  createPlanetMesh,
  createTrailLine,
  type MappedMaterial,
  type PlanetMeshUserData,
} from './solarsystem/builders';
import { loadBodyTextures } from './solarsystem/textures';
import { createSky } from './solarsystem/sky';
import {
  MAX_PITCH_RAD,
  ORBIT_INITIAL_RADIUS,
  ORBIT_INITIAL_YAW,
  ORBIT_DEFAULT_HEIGHT_RATIO,
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
  RENDERER_CLEAR_COLOR,
  RENDERER_CLEAR_ALPHA,
  RENDERER_PIXEL_RATIO,
  GL_MSAA_SAMPLES,
  CAMERA_FOV,
  CAMERA_NEAR,
  CAMERA_FAR,
  AMBIENT_LIGHT_INTENSITY,
  SUNLIGHT_INTENSITY,
  SUNLIGHT_DISTANCE,
  SUNLIGHT_DECAY,
  CBODY_RADIUS_MULTIPLIER,
  PLANET_MESH_X_ROTATION,
  OUTLINE_EDGE_GLOW,
  OUTLINE_EDGE_THICKNESS,
  OUTLINE_PULSE_PERIOD,
  OUTLINE_MIN_PIXELS_FADE_OUT,
  OUTLINE_MIN_PIXELS_FADE_IN,
  OUTLINE_INTENSITY_SMOOTHING,
  OUTLINE_EDGE_STRENGTH,
  OUTLINE_MIN_ENABLED_FACTOR,
  ROCKET_SURFACE_OFFSET,
  ROCKET_LANDING_CLEARANCE,
  ROCKET_MODEL_SCALE,
  DEFAULT_ROCKET_FORWARD,
  ROCKET_SPIN_SPEED,
  PLANE_NORMAL_EPS,
  HELPER_AXIS_THRESHOLD,
  ECLIPTIC_UP,
} from './solarsystem/constants';

// [moved] Helpers moved to './solarsystem/helpers'.

// [moved] Texture loading moved to './solarsystem/textures'.

// [moved] Mesh builders moved to './solarsystem/builders'.

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
        const skyMesh = await createSky();
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
