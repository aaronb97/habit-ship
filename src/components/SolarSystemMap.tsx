// react compiler is being used, avoid using useCallback or useMemo
import { useEffect, useRef, useState } from 'react';
import {
  View,
  useWindowDimensions,
  StyleSheet,
  AppState,
  AppStateStatus,
} from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GestureDetector } from 'react-native-gesture-handler';

import { colors } from '../styles/theme';
import { cBodies as PLANETS, Moon, Planet, earth } from '../planets';
import { getCurrentTime } from '../utils/time';
import { useStore } from '../utils/store';
import { calculateLevel } from '../utils/experience';
import type { UsersDoc } from '../utils/db';
import type { UserPosition } from '../types';
// import { useIsFocused } from '@react-navigation/native';
import { useDebugValues } from '../hooks/useDebugValues';

// Modularized helpers/builders
import { toVec3 } from './solarsystem/helpers';
import { type MappedMaterial } from './solarsystem/builders';
import {
  loadBodyTextures,
  loadRingTextures,
  loadSkinTextures,
} from './solarsystem/textures';
import { createSky } from './solarsystem/sky';
import {
  CameraController,
  clamp01,
  easeInOutCubic,
} from './solarsystem/camera';
import type { CameraCollisionResolver } from './solarsystem/camera';
import { Rocket } from './solarsystem/rocket';
import { CelestialBodyNode, BodyNodesRegistry } from './solarsystem/bodies';
import { getRelevantPlanetSystemsFor } from './solarsystem/relevance';
import { createComposer } from './solarsystem/postprocessing';
import { useComposedGesture } from './solarsystem/gestures';
import { addDefaultLights } from './solarsystem/lights';
import { registerController } from './solarsystem/controllerRegistry';
import {
  RENDERER_CLEAR_COLOR,
  RENDERER_CLEAR_ALPHA,
  RENDERER_PIXEL_RATIO,
  GL_MSAA_SAMPLES,
  CAMERA_FOV,
  CAMERA_NEAR,
  CAMERA_FAR,
  HABIT_TRAVEL_ANIM_MS,
  CAMERA_MOVE_MS,
  CAMERA_HOLD_MS,
  YAW_SIDE_ON_DISTANCE_CUTOFF,
  CAMERA_COLLISION_CLEARANCE,
  ZOOM_MAX_RADIUS,
  ROCKET_LANDING_SPREAD_FRACTION,
  FRIEND_AIM_YAW_OFFSET_STEP_RAD,
} from './solarsystem/constants';
import { getSkinById } from '../utils/skins';
import { DebugOverlay } from './DebugOverlay';
import { SafeAreaView } from 'react-native-safe-area-context';

// [moved] Helpers moved to './solarsystem/helpers'.

// [moved] Texture loading moved to './solarsystem/textures'.

// [moved] Mesh builders moved to './solarsystem/builders'.

export function SolarSystemMap({
  interactive,
  friends,
}: {
  interactive?: boolean;
  /** Optional list of friend entries to render rockets for. */
  friends?: { uid: string; profile: UsersDoc }[];
} = {}) {
  const { width, height } = useWindowDimensions();

  // Refs for scene graph
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cameraControllerRef = useRef<CameraController | null>(null);
  const frameRef = useRef<number | null>(null);
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bodyRegistryRef = useRef<BodyNodesRegistry>(new BodyNodesRegistry());
  const loopFnRef = useRef<(() => void) | null>(null);
  const isAppActiveRef = useRef<boolean>(true);

  const rocketRef = useRef<Rocket | null>(null);
  const displayUserPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const skyRef = useRef<THREE.Mesh | null>(null);
  const friendRocketsRef = useRef<Map<string, Rocket>>(new Map());
  const friendMetaRef = useRef<
    Map<string, { rocketColor: number; selectedSkinId?: string }>
  >(new Map());
  const friendStickyOverridesRef = useRef<
    Map<string, { key: string; theta: number; yaw: number }>
  >(new Map());
  const friendsRef = useRef<{ uid: string; profile: UsersDoc }[]>([]);
  const friendAnimStateRef = useRef<
    Map<string, { key: string; startTs: number; fromAbs: number; toAbs: number }>
  >(new Map());
  const friendDisplayedAbsRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    friendsRef.current = friends ?? [];
  }, [friends]);

  const showTextures = useStore((s) => s.showTextures);
  const showDebugOverlay = useStore((s) => s.showDebugOverlay);

  const userPosState = useStore((s) => s.userPosition);

  const rocketColorFromStore = useStore((s) => s.rocketColor);
  const selectedSkinId = useStore((s) => s.selectedSkinId);
  const activeTabName = useStore((s) => s.activeTab);
  const interactiveEffective = interactive ?? activeTabName === 'MapTab';
  const syncTravelVisuals = useStore((s) => s.syncTravelVisuals);
  const finalizeLandingAfterAnimation = useStore(
    (s) => s.finalizeLandingAfterAnimation,
  );
  const skipRocketAnimation = useStore((s) => s.skipRocketAnimation);

  // Focus replaced by explicit interactive flag from parent (Rocket tab focus)
  const isInteractiveRef = useRef<boolean>(interactiveEffective);
  useEffect(() => {
    isInteractiveRef.current = interactiveEffective;
  }, [
    interactiveEffective,
    skipRocketAnimation,
    syncTravelVisuals,
    finalizeLandingAfterAnimation,
  ]);

  useEffect(() => {
    return () => {
      console.log('SolarSystemMap unmounted');
    };
  }, []);

  /**
   * Computes the display position of a friend's rocket based on their UserPosition.
   * Places the rocket on the surface-to-surface segment between start and target when traveling,
   * otherwise centers it on the current body's visual center.
   *
   * Parameters:
   * - position: Snapshot of the friend's user position and travel state.
   *
   * Returns: Scene-space vector representing the rocket position to render.
   */
  const computeFriendDisplayPos = (position: UserPosition): THREE.Vector3 => {
    const { startingLocation, target, initialDistance, distanceTraveled } =
      position;
    if (
      target &&
      typeof initialDistance === 'number' &&
      typeof distanceTraveled === 'number'
    ) {
      const startBody =
        PLANETS.find((b) => b.name === startingLocation) ?? earth;
      const targetBody = PLANETS.find((b) => b.name === target) ?? earth;
      const startCenter = toVec3(startBody.getVisualPosition());
      const targetCenter = toVec3(targetBody.getVisualPosition());
      const { startSurface, targetSurface } = Rocket.computeSurfaceEndpoints(
        startCenter,
        bodyRegistryRef.current.getVisualRadius(startBody.name),
        targetCenter,
        bodyRegistryRef.current.getVisualRadius(targetBody.name),
      );
      const denom = initialDistance === 0 ? 1 : initialDistance;
      const t = Math.min(1, Math.max(0, distanceTraveled / denom));
      return startSurface.clone().lerp(targetSurface, t);
    }
    const body = PLANETS.find((b) => b.name === startingLocation) ?? earth;
    return toVec3(body.getVisualPosition());
  };

  // Apply runtime color updates to the rocket if already created
  useEffect(() => {
    const rocket = rocketRef.current;
    if (rocket) {
      try {
        rocket.setColor(rocketColorFromStore);
      } catch {
        // ignore
      }
    }
  }, [rocketColorFromStore]);

  // [debug publishing provided by useDebugValues hook]

  // Apply selected skin texture to the rocket hull
  useEffect(() => {
    let canceled = false;
    const apply = async () => {
      const rocket = rocketRef.current;
      if (!rocket) return;
      if (!selectedSkinId) {
        rocket.setBodyTexture(null);
        try {
          const baseColor = useStore.getState().rocketColor;
          rocket.setColor(baseColor);
        } catch {}
        return;
      }

      try {
        const texMap = await loadSkinTextures([selectedSkinId]);
        if (canceled) return;
        const tex = texMap[selectedSkinId] ?? null;
        const skin = getSkinById(selectedSkinId);
        rocket.setBodyTexture(tex, skin?.color);
      } catch {
        // ignore
      }
    };

    void apply();
    return () => {
      canceled = true;
    };
  }, [selectedSkinId]);

  /**
   * Sync friend rockets in the scene whenever the provided friends list changes.
   * Creates missing rockets, updates appearance (color/skin), and disposes rockets no longer needed.
   */
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const composer = composerRef.current;
    const gl = glRef.current;
    if (!scene || !camera || !composer || !gl) return;

    const resolution = new THREE.Vector2(
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
    );
    const list = friendsRef.current;
    const nextUids = new Set<string>(list.map((e) => e.uid));

    // Dispose rockets for users no longer present
    friendRocketsRef.current.forEach((fr, uid) => {
      if (!nextUids.has(uid)) {
        try {
          scene.remove(fr.group);
          fr.dispose();
        } catch {}
        friendRocketsRef.current.delete(uid);
        friendMetaRef.current.delete(uid);
        friendAnimStateRef.current.delete(uid);
        friendDisplayedAbsRef.current.delete(uid);
        if (friendStickyOverridesRef.current.has(uid)) {
          friendStickyOverridesRef.current.delete(uid);
        }
      }
    });

    // Create or update rockets for current users
    const run = async () => {
      for (const { uid, profile } of list) {
        let fr = friendRocketsRef.current.get(uid);
        if (!fr) {
          try {
            fr = await Rocket.create({
              color: profile.rocketColor,
              scene,
              camera,
              composer,
              resolution,
              withoutOutline: true,
              useBasicMaterials: true,
            });
            friendRocketsRef.current.set(uid, fr);
            scene.add(fr.group);
          } catch {
            continue;
          }
        }

        // Update base color if changed
        const prevMeta = friendMetaRef.current.get(uid);
        if (!prevMeta || prevMeta.rocketColor !== profile.rocketColor) {
          try {
            fr.setColor(profile.rocketColor);
          } catch {}
        }

        // Update skin if changed
        if (!prevMeta || prevMeta.selectedSkinId !== profile.selectedSkinId) {
          try {
            if (profile.selectedSkinId) {
              const texMap = await loadSkinTextures([profile.selectedSkinId]);
              const tex = texMap[profile.selectedSkinId] ?? null;
              const skin = getSkinById(profile.selectedSkinId);
              fr.setBodyTexture(tex, skin?.color);
            } else {
              fr.setBodyTexture(null);
            }
          } catch {}
        }

        friendMetaRef.current.set(uid, {
          rocketColor: profile.rocketColor,
          selectedSkinId: profile.selectedSkinId,
        });
      }
    };

    void run();
  }, [friends]);

  // Determine which planet systems are relevant for rendering moons
  const getRelevantPlanetSystems = (): Set<string> => {
    const { startingLocation, target } = useStore.getState().userPosition;
    return getRelevantPlanetSystemsFor(startingLocation, target, PLANETS);
  };

  // Determine which planets are unlocked (visible) at current level
  const getUnlockedBodies = (): Set<string> => {
    const level = calculateLevel(useStore.getState().totalXP);
    const set = new Set<string>();
    PLANETS.forEach((b) => {
      if (b instanceof Planet) {
        const ml = b.minLevel ?? 0;
        if (level >= ml) {
          set.add(b.name);
        }
      }
    });

    return set;
  };

  const getVisitedBodies = (): Set<string> => {
    const completed = useStore.getState().completedPlanets;
    return new Set<string>(completed);
  };

  // Animation durations imported from constants

  // Helpers (imported from camera module)

  // When focused, drive animation timing from focus start or latest distance change
  const focusAnimStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (interactiveEffective) {
      const start = getCurrentTime();
      focusAnimStartRef.current = start;

      const {
        initialDistance,
        previousDistanceTraveled,
        distanceTraveled,
        startingLocation,
        target,
      } = useStore.getState().userPosition;

      const pending =
        typeof distanceTraveled === 'number' &&
        distanceTraveled !== previousDistanceTraveled;

      const denom =
        initialDistance && initialDistance > 0 ? initialDistance : 1;

      const fromAbs = Math.min(
        1,
        Math.max(0, (previousDistanceTraveled ?? 0) / denom),
      );

      const toAbs = Math.min(1, Math.max(0, (distanceTraveled ?? 0) / denom));

      // If start/target centers are very close in scene units, lock yaw side-on for the
      // entire scripted camera sequence to avoid ending up behind the parent body.
      const startBody =
        PLANETS.find((b) => b.name === startingLocation) ?? earth;

      const targetBody = PLANETS.find((b) => b.name === target) ?? earth;
      const startCenter = toVec3(startBody.getVisualPosition());
      const targetCenter = toVec3(targetBody.getVisualPosition());
      const separation = startCenter.distanceTo(targetCenter);
      const lockSideOn = separation < YAW_SIDE_ON_DISTANCE_CUTOFF;

      if (pending) {
        if (skipRocketAnimation) {
          syncTravelVisuals();
          finalizeLandingAfterAnimation();
          animSyncedRef.current = true;
          pendingScriptedStartRef.current = null;
          return;
        }

        const controller = cameraControllerRef.current;
        if (controller) {
          controller.startScriptedCameraFromProgress(
            start,
            controller.state,
            fromAbs,
            toAbs,
            { lockSideOnYaw: lockSideOn },
          );
        } else {
          pendingScriptedStartRef.current = {
            nowTs: start,
            fromAbs,
            toAbs,
            lockSideOn,
          };
        }
      } else {
        pendingScriptedStartRef.current = null;
      }
    } else {
      focusAnimStartRef.current = null;
    }
  }, [
    finalizeLandingAfterAnimation,
    interactiveEffective,
    skipRocketAnimation,
    syncTravelVisuals,
  ]);

  // Reset animation start when distance updates while focused
  const prevDistanceRef = useRef<{ prev?: number; curr?: number }>({});
  const distanceTraveledVal = userPosState.distanceTraveled;
  const previousDistanceTraveledVal = userPosState.previousDistanceTraveled;
  useEffect(() => {
    const changed =
      distanceTraveledVal !== prevDistanceRef.current.curr ||
      previousDistanceTraveledVal !== prevDistanceRef.current.prev;

    if (changed && isInteractiveRef.current) {
      if (skipRocketAnimation) {
        syncTravelVisuals();
        finalizeLandingAfterAnimation();
        animSyncedRef.current = true;
        pendingScriptedStartRef.current = null;
        const { distanceTraveled, previousDistanceTraveled } =
          useStore.getState().userPosition;

        prevDistanceRef.current = {
          prev: previousDistanceTraveled,
          curr: distanceTraveled,
        };

        return;
      }

      const start = getCurrentTime();
      focusAnimStartRef.current = start;

      const { initialDistance } = useStore.getState().userPosition;
      const denom =
        initialDistance && initialDistance > 0 ? initialDistance : 1;

      const fromAbs = clamp01((previousDistanceTraveledVal ?? 0) / denom);
      const toAbs = clamp01((distanceTraveledVal ?? 0) / denom);

      // Check separation again on distance change; if small, lock yaw side-on.
      const { startingLocation, target } = useStore.getState().userPosition;
      const startBody =
        PLANETS.find((b) => b.name === startingLocation) ?? earth;

      const targetBody = PLANETS.find((b) => b.name === target) ?? earth;
      const startCenter = toVec3(startBody.getVisualPosition());
      const targetCenter = toVec3(targetBody.getVisualPosition());
      const separation = startCenter.distanceTo(targetCenter);
      const lockSideOn = separation < YAW_SIDE_ON_DISTANCE_CUTOFF;
      // Configure controller policies for short-hop
      const controller = cameraControllerRef.current;
      if (controller) {
        controller.startScriptedCameraFromProgress(
          start,
          controller.state,
          fromAbs,
          toAbs,
          { lockSideOnYaw: lockSideOn },
        );
      } else {
        pendingScriptedStartRef.current = {
          nowTs: start,
          fromAbs,
          toAbs,
          lockSideOn,
        };
      }
    }

    // If values differ, an animation is pending; if equal, batch already synced
    animSyncedRef.current = previousDistanceTraveledVal === distanceTraveledVal;
    prevDistanceRef.current = {
      prev: previousDistanceTraveledVal,
      curr: distanceTraveledVal,
    };
  }, [
    distanceTraveledVal,
    previousDistanceTraveledVal,
    skipRocketAnimation,
    syncTravelVisuals,
    finalizeLandingAfterAnimation,
  ]);

  useEffect(() => {
    if (!interactiveEffective) {
      return;
    }

    if (!skipRocketAnimation) {
      return;
    }

    const { distanceTraveled, previousDistanceTraveled } =
      useStore.getState().userPosition;

    const hasDelta = distanceTraveled !== previousDistanceTraveled;
    if (hasDelta) {
      syncTravelVisuals();
      finalizeLandingAfterAnimation();
      animSyncedRef.current = true;
      pendingScriptedStartRef.current = null;
    }
  }, [
    skipRocketAnimation,
    interactiveEffective,
    syncTravelVisuals,
    finalizeLandingAfterAnimation,
    distanceTraveledVal,
    previousDistanceTraveledVal,
  ]);

  const animAlphaRef = useRef(0);
  const animSyncedRef = useRef(true);

  const pendingScriptedStartRef = useRef<{
    nowTs: number;
    fromAbs: number;
    toAbs: number;
    lockSideOn: boolean;
  } | null>(null);

  // ----- Debug overlay state (generic hook) -----
  const [debugExpanded, setDebugExpanded] = useState(false);
  const {
    values: debugValues,
    history: debugHistory,
    minMax: debugMinMax,
    publish: publishDebug,
  } = useDebugValues({ windowMs: 10000 });

  // Helper: read visual radius (scene units) for a body
  const getVisualRadius = (name: string): number => {
    return bodyRegistryRef.current.getVisualRadius(name);
  };

  /**
   * Computes a friend's surface position and aim vector on the start body using
   * a stable tangent basis around the start-target axis.
   *
   * Parameters:
   * - startName: Name of the start celestial body where the friend is landed.
   * - targetName: Name of the target celestial body the friend is aiming toward.
   * - theta: Tangent-plane angle in radians for lateral spread around the start.
   * - yaw: Yaw offset in radians to rotate the aim slightly around the radial axis.
   *
   * Returns: Object with pos (surface position) and aim (look-at target) in scene space.
   */
  const computeFriendSurfacePosAim = (
    startName: string,
    targetName: string,
    theta: number,
    yaw: number,
  ): { pos: THREE.Vector3; aim: THREE.Vector3 } => {
    const startBody = PLANETS.find((b) => b.name === startName) ?? earth;
    const targetBody = PLANETS.find((b) => b.name === targetName) ?? earth;
    const startCenter = toVec3(startBody.getVisualPosition());
    const targetCenter = toVec3(targetBody.getVisualPosition());
    const startRadius = getVisualRadius(startBody.name);
    const dirN = targetCenter.clone().sub(startCenter).normalize();
    const baseStartSurface = startCenter
      .clone()
      .add(dirN.clone().multiplyScalar(startRadius));
    const aimBase = Rocket.computeAimPosition(
      startCenter,
      targetCenter,
      getVisualRadius(targetBody.name),
    );
    const baseAimDir = aimBase.clone().sub(baseStartSurface);

    let helper = new THREE.Vector3(0, 0, 1);
    if (Math.abs(dirN.dot(helper)) > 0.98) helper = new THREE.Vector3(1, 0, 0);
    const r = dirN.clone().cross(helper).normalize();
    const u = r.clone().cross(dirN).normalize();

    const alpha = Math.max(0, ROCKET_LANDING_SPREAD_FRACTION);
    const offsetDir = r
      .clone()
      .multiplyScalar(Math.cos(theta))
      .add(u.clone().multiplyScalar(Math.sin(theta)));
    const newDir = dirN.clone().add(offsetDir.multiplyScalar(alpha)).normalize();
    const pos = startCenter.clone().add(newDir.multiplyScalar(startRadius));

    const aimDir = baseAimDir.clone().applyAxisAngle(dirN, yaw);
    const aim = pos.clone().add(aimDir);
    return { pos, aim };
  };

  /**
   * Computes a friend's in-flight position offset next to the centerline and a
   * matching aim direction so all rockets point the same way while traveling.
   *
   * Parameters:
   * - startName: Name of the start celestial body.
   * - targetName: Name of the target celestial body.
   * - basePos: Centerline interpolated position of the friend.
   * - theta: Tangent-plane angle in radians for lateral spread around the path.
   *
   * Returns: Object with pos (offset from centerline) and aim (look-at target).
   */
  const computeFriendTravelPosAim = (
    startName: string,
    targetName: string,
    basePos: THREE.Vector3,
    theta: number,
  ): { pos: THREE.Vector3; aim: THREE.Vector3 } => {
    const startBody = PLANETS.find((b) => b.name === startName) ?? earth;
    const targetBody = PLANETS.find((b) => b.name === targetName) ?? earth;
    const startCenter = toVec3(startBody.getVisualPosition());
    const targetCenter = toVec3(targetBody.getVisualPosition());
    const dir = targetCenter.clone().sub(startCenter);
    const dirN = dir.clone().normalize();
    let helper = new THREE.Vector3(0, 0, 1);
    if (Math.abs(dirN.dot(helper)) > 0.98) helper = new THREE.Vector3(1, 0, 0);
    const r = dirN.clone().cross(helper).normalize();
    const u = r.clone().cross(dirN).normalize();

    const lateralDir = r
      .clone()
      .multiplyScalar(Math.cos(theta))
      .add(u.clone().multiplyScalar(Math.sin(theta)));
    const lateralMag = Math.max(0, ROCKET_LANDING_SPREAD_FRACTION) *
      getVisualRadius(startBody.name);
    const pos = basePos.clone().add(lateralDir.multiplyScalar(lateralMag));

    // Keep everyone pointing exactly along the path direction
    const aim = pos.clone().add(dirN);
    return { pos, aim };
  };

  const computeDisplayUserPos = (): THREE.Vector3 => {
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
      // Only animate rocket when there is a pending distance delta to show
      const shouldAnimateTravel =
        isInteractiveRef.current &&
        !animSyncedRef.current &&
        !skipRocketAnimation;

      const effectiveStart =
        (shouldAnimateTravel ? focusAnimStartRef.current : null) ?? now;

      const elapsed = Math.max(0, now - effectiveStart);
      const preRoll = CAMERA_MOVE_MS + CAMERA_HOLD_MS;
      const rocketAlpha = shouldAnimateTravel
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

      const targetBody = PLANETS.find((b) => b.name === target) ?? earth;

      const startCenter = toVec3(startBody.getVisualPosition());
      const targetCenter = toVec3(targetBody.getVisualPosition());

      const { startSurface, targetSurface } = Rocket.computeSurfaceEndpoints(
        startCenter,
        getVisualRadius(startBody.name),
        targetCenter,
        getVisualRadius(targetBody.name),
      );

      return startSurface.clone().lerp(targetSurface, t);
    }

    // Not traveling: snap to the current body's displayed center
    const body =
      PLANETS.find(
        (b) => b.name === useStore.getState().userPosition.startingLocation,
      ) ?? earth;

    const center = toVec3(body.getVisualPosition());
    return center;
  };

  // Double-tap: delegate to controller's configurable cycle
  const zoomCamera = () => {
    const controller = cameraControllerRef.current;
    if (!controller) {
      return;
    }

    controller.cycleDoubleTap();
  };

  // Gesture composition via hook (persists pan accumulators internally)
  const gesture = useComposedGesture({
    controllerRef: cameraControllerRef,
    width,
    height,
    onDoubleTap: zoomCamera,
    enabled: interactiveEffective,
  });

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
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
    const ringTexturesByName = showTextures
      ? await loadRingTextures(PLANETS.map((p) => p.name))
      : {};

    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      drawingBufferWidth / drawingBufferHeight,
      CAMERA_NEAR,
      CAMERA_FAR,
    );

    cameraRef.current = camera;
    // Create camera controller and start any pending scripted sequence
    cameraControllerRef.current = new CameraController(camera);
    // Install collision resolver to prevent camera from entering body geometry
    {
      /**
       * Compute the minimum safe radius to keep the camera outside any visible
       * planet/moon when the desired camera position would be inside it.
       * @param center Orbit center in scene units.
       * @param desiredPos Desired camera position computed for this frame.
       * @param radius Current camera radius.
       * @returns Minimum safe radius (>= radius) to avoid clipping.
       */
      const resolver: CameraCollisionResolver = ({
        center,
        desiredPos,
        radius,
      }) => {
        let safe = radius;
        const dir = desiredPos.clone().sub(center);
        const rLen = dir.length();
        if (rLen <= 1e-9) {
          return safe;
        }
        dir.multiplyScalar(1 / rLen); // normalize

        bodyRegistryRef.current.forEach((node) => {
          // Only consider planets and moons for collision; ignore stars like the Sun
          if (!(node.body instanceof Planet || node.body instanceof Moon)) {
            return;
          }
          if (!node.mesh.visible) {
            return;
          }
          const sphereCenter = node.mesh.position;
          const R = node.getVisualRadius() + CAMERA_COLLISION_CLEARANCE;
          // If desired position is already safely outside, skip costly solve
          const distToDesired = desiredPos.distanceTo(sphereCenter);
          if (distToDesired >= R) {
            return;
          }

          // Solve quadratic for intersection along the ray center + t*dir
          const A = center.clone().sub(sphereCenter);
          const b = A.dot(dir);
          const c = A.lengthSq() - R * R;
          const disc = b * b - c;
          if (disc < 0) {
            return; // no intersection
          }

          const t2 = -b + Math.sqrt(disc); // far intersection distance along dir
          if (t2 > safe) {
            safe = t2;
          }
        });

        // Clamp to overall maximum zoom
        if (safe > ZOOM_MAX_RADIUS) {
          safe = ZOOM_MAX_RADIUS;
        }

        return safe;
      };

      cameraControllerRef.current.setCollisionResolver(resolver);
    }
    // Expose controller to screens for gesture forwarding when overlay is behind
    registerController(cameraControllerRef.current);
    if (pendingScriptedStartRef.current) {
      const p = pendingScriptedStartRef.current;
      cameraControllerRef.current.startScriptedCameraFromProgress(
        p.nowTs,
        cameraControllerRef.current.state,
        p.fromAbs,
        p.toAbs,
        { lockSideOnYaw: p.lockSideOn },
      );

      pendingScriptedStartRef.current = null;
    }

    // Post-processing composer with base render and final copy pass
    const composer = createComposer(
      renderer,
      scene,
      camera,
      new THREE.Vector2(drawingBufferWidth, drawingBufferHeight),
    );

    composerRef.current = composer;

    // Lights
    addDefaultLights(scene);

    // Create Rocket instance (with outline matching rocket color)
    try {
      const resolution = new THREE.Vector2(
        drawingBufferWidth,
        drawingBufferHeight,
      );

      const rocket = await Rocket.create({
        color: rocketColorFromStore,
        scene,
        camera,
        composer,
        resolution,
      });

      rocketRef.current = rocket;
      scene.add(rocket.group);
      // Hide rocket until a target is set
      const hasTarget = !!useStore.getState().userPosition.target;
      rocket.setVisible(hasTarget);

      // Apply any persisted selected skin immediately on creation
      try {
        const persistedSkinId = useStore.getState().selectedSkinId;
        if (persistedSkinId) {
          const texMap = await loadSkinTextures([persistedSkinId]);
          const tex = texMap[persistedSkinId] ?? null;
          const skin = getSkinById(persistedSkinId);
          rocket.setBodyTexture(tex, skin?.color);
        } else {
          rocket.setBodyTexture(null);
        }
      } catch {
        // ignore
      }
    } catch (e) {
      console.warn('[SolarSystemMap] Failed to create Rocket, skipping model');
      console.warn(e);
    }

    // Initialize friend rockets for the current friends list
    try {
      const glCtx = glRef.current;
      const resolution = new THREE.Vector2(
        glCtx.drawingBufferWidth,
        glCtx.drawingBufferHeight,
      );
      const list = friendsRef.current;
      for (const entry of list) {
        const { uid, profile } = entry;
        if (friendRocketsRef.current.has(uid)) continue;
        try {
          const fr = await Rocket.create({
            color: profile.rocketColor,
            scene,
            camera,
            composer,
            resolution,
            withoutOutline: true,
            useBasicMaterials: true,
          });
          friendRocketsRef.current.set(uid, fr);
          scene.add(fr.group);
          // Apply selected skin (if any)
          if (profile.selectedSkinId) {
            try {
              const texMap = await loadSkinTextures([profile.selectedSkinId]);
              const tex = texMap[profile.selectedSkinId] ?? null;
              const skin = getSkinById(profile.selectedSkinId);
              fr.setBodyTexture(tex, skin?.color);
            } catch {}
          }
          friendMetaRef.current.set(uid, {
            rocketColor: profile.rocketColor,
            selectedSkinId: profile.selectedSkinId,
          });
        } catch {}
      }
    } catch {}

    const relevantSystems = getRelevantPlanetSystems();
    const unlockedBodies = getUnlockedBodies();
    const visitedBodies = getVisitedBodies();
    const startName = useStore.getState().userPosition.startingLocation;
    const targetName = useStore.getState().userPosition.target;
    const showTrailsInit = useStore.getState().showTrails;

    // Create body nodes with encapsulated mesh/trail/outline behavior
    const resolution = new THREE.Vector2(
      drawingBufferWidth,
      drawingBufferHeight,
    );

    PLANETS.forEach((p) => {
      const texture = showTextures ? texturesByName[p.name] : undefined;
      const ringTexture = showTextures ? ringTexturesByName[p.name] : undefined;
      const node = new CelestialBodyNode({
        body: p,
        scene,
        camera,
        composer,
        resolution,
        texture,
        ringTexture,
        initialTrailsEnabled: useStore.getState().showTrails,
      });

      // Set initial visibility to reduce flicker before first update()
      if (p instanceof Moon) {
        const allowed = relevantSystems.has(p.orbits);
        node.setVisible(allowed);
        node.setTrailsEnabled(showTrailsInit && allowed);
      } else if (p instanceof Planet) {
        const always = Boolean(p.alwaysRenderIfDiscovered);
        const isVisited = visitedBodies.has(p.name);
        const isStart = p.name === startName;
        const isTarget = p.name === targetName;
        const isUnlocked = unlockedBodies.has(p.name);
        const allowed = always
          ? isUnlocked || isVisited || isStart || isTarget
          : isVisited || isStart || isTarget;
        node.setVisible(allowed);
        node.setTrailsEnabled(showTrailsInit && allowed);
      }

      bodyRegistryRef.current.add(node);
    });

    // (Final copy pass is added in createComposer)

    // Animation loop
    const renderLoop = () => {
      if (!isAppActiveRef.current) {
        return;
      }

      const { showTrails } = useStore.getState();

      // No per-frame spin integration; positions only
      // Compute display user position for this frame
      displayUserPosRef.current = computeDisplayUserPos();

      // If focused and an animation batch is pending, mark it as seen once complete
      if (!animSyncedRef.current) {
        const { distanceTraveled, previousDistanceTraveled } =
          useStore.getState().userPosition;

        const complete =
          animAlphaRef.current >= 0.999 ||
          distanceTraveled === previousDistanceTraveled;

        if (complete) {
          try {
            if (isInteractiveRef.current) {
              syncTravelVisuals();
              // If a landing was reached by the last completion, finalize it now
              if (useStore.getState().pendingLanding) {
                finalizeLandingAfterAnimation();
              }
            }
          } finally {
            // Keep animSyncedRef gated to interactive so animation can still play when user opens Map
            if (isInteractiveRef.current) {
              animSyncedRef.current = true;
            }
          }
        }
      }

      // Compute small separation offsets for friend rockets clustered at the start.
      const clusterFriendOverrides = new Map<
        string,
        { pos: THREE.Vector3; aim: THREE.Vector3 }
      >();
      {
        const upos = useStore.getState().userPosition;
        const userKey =
          upos.target && (upos.distanceTraveled ?? 0) <= 1e-9
            ? `${upos.startingLocation}|${upos.target}`
            : null;

        const list = friendsRef.current;
        if (list.length > 0) {
          type Entry = { uid: string; start: string; target: string };
          const clusters = new Map<string, Entry[]>();
          for (const e of list) {
            const fp = e.profile.userPosition;
            const t = fp.target;
            if (!t) continue;
            const fAtStart = (fp.distanceTraveled ?? 0) <= 1e-9;
            if (!fAtStart) continue;
            const key = `${fp.startingLocation}|${t}`;
            let arr = clusters.get(key);
            if (!arr) {
              arr = [];
              clusters.set(key, arr);
            }
            arr.push({ uid: e.uid, start: fp.startingLocation, target: t });
          }

          clusters.forEach((arr, key) => {
            const n = arr.length;
            const shouldOffset = n > 1 || (userKey && key === userKey && n >= 1);
            if (!shouldOffset) return;
            const angStep = Math.min(Math.PI / 4, (2 * Math.PI) / Math.max(3, n + 1));
            const sorted = [...arr].sort((a, b) => (a.uid < b.uid ? -1 : 1));
            sorted.forEach((entry, idx) => {
              const rel = idx - (n - 1) / 2;
              const existing = friendStickyOverridesRef.current.get(entry.uid);
              let theta: number;
              let yaw: number;
              if (existing && existing.key === key) {
                theta = existing.theta;
                yaw = existing.yaw;
              } else {
                theta = rel * angStep;
                let relYaw = rel;
                if (relYaw === 0) relYaw = 1;
                yaw = relYaw * FRIEND_AIM_YAW_OFFSET_STEP_RAD;
                friendStickyOverridesRef.current.set(entry.uid, {
                  key,
                  theta,
                  yaw,
                });
              }

              const { pos, aim } = computeFriendSurfacePosAim(
                entry.start,
                entry.target,
                theta,
                yaw,
              );
              clusterFriendOverrides.set(entry.uid, { pos, aim });
            });
          });
        }
      }

      // Scripted camera progression is handled inside CameraController.tick()
      if (rocketRef.current) {
        const { target, startingLocation } = useStore.getState().userPosition;
        if (!target) {
          // No target selected: keep rocket hidden and skip updates
          rocketRef.current.setVisible(false);
        } else {
          rocketRef.current.setVisible(true);
          // Determine aim target in scene units (prefer surface endpoint when traveling)
          const startBody =
            PLANETS.find((b) => b.name === startingLocation) ?? earth;

          const targetBody = PLANETS.find((b) => b.name === target) ?? earth;

          const startCenter = toVec3(startBody.getVisualPosition());
          const targetCenter = toVec3(targetBody.getVisualPosition());

          const aimPos = Rocket.computeAimPosition(
            startCenter,
            targetCenter,
            getVisualRadius(targetBody.name),
          );

          // Only spin/move/exhaust when a travel animation is pending
          const shouldAnimateTravel =
            isInteractiveRef.current && !animSyncedRef.current;

          rocketRef.current.update(
            displayUserPosRef.current,
            aimPos,
            shouldAnimateTravel,
            animAlphaRef.current,
          );
        }
      }

      // Update friend rockets (positions, visibility, minimum size)
      {
        const cam = cameraRef.current as THREE.PerspectiveCamera | null;
        const glCtx = glRef.current;
        if (cam && glCtx) {
          const resH = glCtx.drawingBufferHeight;
          const list = friendsRef.current;
          const now = getCurrentTime();
          const friendAnimView = new Map<
            string,
            { abs: number; tAlpha: number; traveling: boolean; key: string }
          >();
          for (const e of list) {
            const uid = e.uid;
            const fp = e.profile.userPosition;
            const key = fp.target ? `${fp.startingLocation}|${fp.target}` : '';
            const hasTravel =
              !!fp.target &&
              typeof fp.initialDistance === 'number' &&
              typeof fp.distanceTraveled === 'number' &&
              fp.initialDistance > 0;

            if (!hasTravel) {
              // Reset animation state if not traveling
              const existing = friendAnimStateRef.current.get(uid);
              if (existing) friendAnimStateRef.current.delete(uid);
              friendDisplayedAbsRef.current.set(uid, 0);
              friendAnimView.set(uid, { abs: 0, tAlpha: 0, traveling: false, key });
              continue;
            }

            const denom = Math.max(1, fp.initialDistance ?? 1);
            const newAbs = Math.min(1, Math.max(0, (fp.distanceTraveled ?? 0) / denom));
            let state = friendAnimStateRef.current.get(uid);

            // If key changed mid-flight, restart from current displayed value
            if (state && state.key !== key) {
              const elapsed = Math.max(0, now - state.startTs);
              const t = Math.min(1, elapsed / HABIT_TRAVEL_ANIM_MS);
              const ease = easeInOutCubic(t);
              const currAbs = state.fromAbs + (state.toAbs - state.fromAbs) * ease;
              friendDisplayedAbsRef.current.set(uid, currAbs);
              state = undefined;
              friendAnimStateRef.current.delete(uid);
            }

            const lastAbs = friendDisplayedAbsRef.current.get(uid) ?? newAbs;
            const delta = Math.abs(newAbs - (state ? state.toAbs : lastAbs));
            if (!state && delta > 1e-9) {
              // Start a new animation from last displayed to new value
              const fromAbs = lastAbs;
              friendAnimStateRef.current.set(uid, {
                key,
                startTs: now,
                fromAbs,
                toAbs: newAbs,
              });
              state = friendAnimStateRef.current.get(uid)!;
            } else if (state && Math.abs(newAbs - state.toAbs) > 1e-9) {
              // Update running animation to head toward latest value
              const elapsed = Math.max(0, now - state.startTs);
              const t = Math.min(1, elapsed / HABIT_TRAVEL_ANIM_MS);
              const ease = easeInOutCubic(t);
              const currAbs = state.fromAbs + (state.toAbs - state.fromAbs) * ease;
              state.fromAbs = currAbs;
              state.toAbs = newAbs;
              state.startTs = now;
            }

            let displayAbs = newAbs;
            let tAlpha = 0;
            if (state) {
              const elapsed = Math.max(0, now - state.startTs);
              const t = Math.min(1, elapsed / HABIT_TRAVEL_ANIM_MS);
              tAlpha = t;
              const ease = easeInOutCubic(t);
              displayAbs = state.fromAbs + (state.toAbs - state.fromAbs) * ease;
              if (t >= 1) {
                // Settle and clear
                friendAnimStateRef.current.delete(uid);
              }
            }
            friendDisplayedAbsRef.current.set(uid, displayAbs);
            const traveling = displayAbs > 0 + 1e-9 && displayAbs < 1 - 1e-9;
            friendAnimView.set(uid, { abs: displayAbs, tAlpha, traveling, key });
          }
          const userNow = useStore.getState().userPosition;
          const userTravelKey =
            userNow.target && typeof userNow.initialDistance === 'number' &&
            typeof userNow.distanceTraveled === 'number' &&
            (userNow.distanceTraveled ?? 0) > 1e-9 &&
            (userNow.initialDistance ?? 0) - (userNow.distanceTraveled ?? 0) > 1e-9
              ? `${userNow.startingLocation}|${userNow.target}`
              : null;
          type Entry = { uid: string; start: string; target: string };
          const travelClusters = new Map<string, Entry[]>();
          for (const e of list) {
            const fp = e.profile.userPosition;
            if (
              fp.target &&
              typeof fp.initialDistance === 'number' &&
              typeof fp.distanceTraveled === 'number' &&
              fp.distanceTraveled > 1e-9 &&
              fp.initialDistance - fp.distanceTraveled > 1e-9
            ) {
              const key = `${fp.startingLocation}|${fp.target}`;
              let arr = travelClusters.get(key);
              if (!arr) {
                arr = [];
                travelClusters.set(key, arr);
              }
              arr.push({ uid: e.uid, start: fp.startingLocation, target: fp.target });
            }
          }

          const clusterFriendTravelOverrides = new Map<
            string,
            { pos: THREE.Vector3; aim: THREE.Vector3 }
          >();
          travelClusters.forEach((arr, key) => {
            const n = arr.length;
            if (n <= 0) return;
            const includeUser = userTravelKey === key;
            const angStep = Math.min(Math.PI / 4, (2 * Math.PI) / Math.max(3, (includeUser ? n + 1 : n)));
            const sorted = [...arr].sort((a, b) => (a.uid < b.uid ? -1 : 1));
            sorted.forEach((entry, idx) => {
              let rel = idx - (n - 1) / 2;
              if (includeUser) {
                // Skip center slot (reserved for user)
                if (rel >= 0) rel += 1;
              }

              const existing = friendStickyOverridesRef.current.get(entry.uid);
              let theta: number;
              if (existing && existing.key === key) {
                theta = existing.theta;
              } else {
                theta = rel * angStep;
                friendStickyOverridesRef.current.set(entry.uid, {
                  key,
                  theta,
                  yaw: 0,
                });
              }

              // Compute per-friend base position along centerline then offset
              const prof = list.find((x) => x.uid === entry.uid)?.profile;
              let basePos = new THREE.Vector3();
              if (prof) {
                const fp = prof.userPosition;
                // Start with non-animated base for safety
                basePos = computeFriendDisplayPos(fp);
                // If anim view is available, lerp along path using animated fraction
                const view = friendAnimView.get(entry.uid);
                if (view && fp.target) {
                  const startBody = PLANETS.find((b) => b.name === fp.startingLocation) ?? earth;
                  const targetBody = PLANETS.find((b) => b.name === fp.target) ?? earth;
                  const startCenter = toVec3(startBody.getVisualPosition());
                  const targetCenter = toVec3(targetBody.getVisualPosition());
                  const { startSurface, targetSurface } = Rocket.computeSurfaceEndpoints(
                    startCenter,
                    getVisualRadius(startBody.name),
                    targetCenter,
                    getVisualRadius(targetBody.name),
                  );
                  basePos = startSurface.clone().lerp(targetSurface, view.abs);
                }
              }
              const { pos, aim } = computeFriendTravelPosAim(
                entry.start,
                entry.target,
                basePos,
                theta,
              );
              clusterFriendTravelOverrides.set(entry.uid, { pos, aim });
            });
          });

          const byUid: Record<string, UsersDoc> = {};
          for (const e of list) byUid[e.uid] = e.profile;
          friendRocketsRef.current.forEach((fr, uid) => {
            const prof = byUid[uid];
            if (!prof) return;
            const fp = prof.userPosition;
            const startOverride = clusterFriendOverrides.get(uid);
            const travelOverride = clusterFriendTravelOverrides.get(uid);
            const clusterKey = fp.target ? `${fp.startingLocation}|${fp.target}` : null;
            let pos = (travelOverride ?? startOverride)?.pos;
            if (!pos) {
              // Fallback to displayed base position (animated when possible)
              const fallbackBase = computeFriendDisplayPos(fp);
              if (fp.target) {
                const startBody = PLANETS.find((b) => b.name === fp.startingLocation) ?? earth;
                const targetBody = PLANETS.find((b) => b.name === fp.target) ?? earth;
                const startCenter = toVec3(startBody.getVisualPosition());
                const targetCenter = toVec3(targetBody.getVisualPosition());
                const { startSurface, targetSurface } = Rocket.computeSurfaceEndpoints(
                  startCenter,
                  getVisualRadius(startBody.name),
                  targetCenter,
                  getVisualRadius(targetBody.name),
                );
                const view = friendAnimView.get(uid);
                const abs = view ? view.abs : undefined;
                pos =
                  typeof abs === 'number'
                    ? startSurface.clone().lerp(targetSurface, abs)
                    : fallbackBase;
              } else {
                pos = fallbackBase;
              }
            }
            // Aim toward target surface if traveling; otherwise face current body
            const { startingLocation, target } = fp;
            const startBody =
              PLANETS.find((b) => b.name === startingLocation) ?? earth;
            const targetBody =
              PLANETS.find((b) => b.name === (target ?? startingLocation)) ??
              earth;
            let defaultAim: THREE.Vector3;
            if (travelOverride) {
              defaultAim = travelOverride.aim;
            } else {
              defaultAim = Rocket.computeAimPosition(
                toVec3(startBody.getVisualPosition()),
                toVec3(targetBody.getVisualPosition()),
                getVisualRadius(targetBody.name),
              );
              // If we have a sticky start override, apply it
              if (!startOverride && clusterKey) {
                const sticky = friendStickyOverridesRef.current.get(uid);
                if (sticky && sticky.key === clusterKey && (fp.distanceTraveled ?? 0) <= 1e-9) {
                  const res = computeFriendSurfacePosAim(
                    startingLocation,
                    target ?? startingLocation,
                    sticky.theta,
                    sticky.yaw,
                  );
                  pos = res.pos;
                  defaultAim = res.aim;
                }
              }
            }
            const aimPos = (travelOverride ?? startOverride)?.aim ?? defaultAim;
            const view = friendAnimView.get(uid);
            const traveling = view ? view.traveling : false;
            const tAlpha = view ? view.tAlpha : 0;
            fr.setVisible(true);
            fr.update(pos, aimPos, traveling, tAlpha);
            fr.enforceMinimumApparentSize(cam, resH);

            // Clear sticky if the friend cleared target or changed key
            if (!clusterKey) {
              if (friendStickyOverridesRef.current.has(uid)) {
                friendStickyOverridesRef.current.delete(uid);
              }
            } else {
              const sticky = friendStickyOverridesRef.current.get(uid);
              if (sticky && sticky.key !== clusterKey) {
                friendStickyOverridesRef.current.delete(uid);
              }
            }
          });
        }
      }

      // Update all body nodes (positions, visibility, trails, outline fade)
      {
        const relevantSystemsNow = getRelevantPlanetSystems();
        const glCtx = glRef.current;
        if (glCtx) {
          const unlockedBodiesNow = getUnlockedBodies();
          const visitedBodiesNow = getVisitedBodies();
          const startingLocationNow =
            useStore.getState().userPosition.startingLocation;
          const targetNameNow = useStore.getState().userPosition.target;
          bodyRegistryRef.current.forEach((node) =>
            node.update({
              glHeight: glCtx.drawingBufferHeight,
              relevantSystems: relevantSystemsNow,
              showTrails,
              unlockedBodies: unlockedBodiesNow,
              visitedBodies: visitedBodiesNow,
              startingLocation: startingLocationNow,
              targetName: targetNameNow,
            }),
          );
        }
      }

      // CameraController: compute center/target and tick
      {
        const controller = cameraControllerRef.current;
        const cam = cameraRef.current;
        if (controller && cam) {
          const { target: targetState } = useStore.getState().userPosition;

          const targetBody =
            PLANETS.find((b) => b.name === targetState) ?? earth;

          let center = displayUserPosRef.current.clone();
          const rocket = rocketRef.current;
          if (rocket && rocket.group.visible) {
            try {
              center = rocket.getOrbitCenter();
            } catch {}
          }
          const targetVisual = targetState
            ? toVec3(targetBody.getVisualPosition())
            : center.clone();

          // If the target is The Moon, force the orbit plane normal to Y-up (align to XZ plane)
          const planeOverride =
            targetState === 'The Moon' ? new THREE.Vector3(0, 0, 1) : undefined;

          controller.tick(center, targetVisual, planeOverride);
        }
      }

      // Enforce a minimum apparent size for the rocket regardless of zoom
      {
        const cam = cameraRef.current;
        const rocket = rocketRef.current;
        const glCtx = glRef.current;
        if (rocket && cam && glCtx) {
          rocket.enforceMinimumApparentSize(cam, glCtx.drawingBufferHeight);
        }
      }

      // Keep sky centered on the camera to avoid parallax and clipping
      {
        const cam = cameraRef.current;
        const sky = skyRef.current;
        if (cam && sky) {
          sky.position.copy(cam.position);
        }
      }

      let fps = 0;
      const frameStart = performance.now();
      if (composerRef.current) {
        composerRef.current.render();
      } else {
        renderer.render(scene, camera);
      }

      const elapsed = performance.now() - frameStart;
      fps = elapsed > 0 ? 1000 / elapsed : 0;

      // Collect debug metrics and publish via single function
      {
        const controller = cameraControllerRef.current;
        const state = controller?.state;
        const yaw = state?.yaw ?? 0;
        const pitch = state?.pitch ?? 0;
        const animAlpha = animAlphaRef.current;
        if (cameraControllerRef.current) {
          publishDebug({
            fps,
            yaw,
            pitch,
            radius: cameraControllerRef.current.radius,
            animAlpha,
            cameraPhase: cameraControllerRef.current.getCameraPhase(),
          });
        }
      }

      gl.endFrameEXP();
      frameRef.current = requestAnimationFrame(renderLoop);
    };

    loopFnRef.current = renderLoop;
    frameRef.current = requestAnimationFrame(renderLoop);
  };

  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      const isActive = state === 'active';
      console.log('AppState', state);
      isAppActiveRef.current = isActive;
      if (!isActive) {
        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current);
        }

        frameRef.current = null;
        return;
      }

      if (!frameRef.current && loopFnRef.current) {
        frameRef.current = requestAnimationFrame(loopFnRef.current);
      }
    };

    const sub = AppState.addEventListener('change', handler);
    return () => {
      sub.remove();
    };
  }, []);

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

      // Update body node outline resolutions so edges stay crisp on resize
      bodyRegistryRef.current.setResolution(
        new THREE.Vector2(drawingBufferWidth, drawingBufferHeight),
      );

      // Update rocket outline resolution
      if (rocketRef.current) {
        rocketRef.current.setResolution(
          new THREE.Vector2(drawingBufferWidth, drawingBufferHeight),
        );
      }
      // Update friend rocket outline resolutions
      friendRocketsRef.current.forEach((fr) =>
        fr.setResolution(
          new THREE.Vector2(drawingBufferWidth, drawingBufferHeight),
        ),
      );
    }
  }, [width, height]);

  // Cleanup
  useEffect(() => {
    console.log('[SolarSystemMap] mounted');
    const registryAtMount = bodyRegistryRef.current;
    return () => {
      // Unregister controller on unmount
      registerController(null);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }

      // Dispose body nodes first to remove their meshes and trails
      try {
        registryAtMount.disposeAll();
      } catch (e) {
        console.warn(e);
      }

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
        // Dispose rocket resources first
        try {
          rocketRef.current?.dispose();
        } catch (e) {
          console.warn(e);
        }
        // Dispose friend rockets
        try {
          friendRocketsRef.current.forEach((fr) => {
            try {
              sceneRef.current?.remove(fr.group);
              fr.dispose();
            } catch {}
          });
          friendRocketsRef.current.clear();
          friendMetaRef.current.clear();
        } catch {}

        // Dispose postprocessing passes and composer
        if (composerRef.current) {
          try {
            composerRef.current.dispose();
          } catch (e) {
            console.warn(e);
          }

          composerRef.current = null;
        }

        rendererRef.current.dispose();
      }
    };
  }, []);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.container}
        pointerEvents={interactiveEffective ? 'auto' : 'none'}
      >
        <GLView
          style={styles.gl}
          msaaSamples={GL_MSAA_SAMPLES}
          onContextCreate={onContextCreate}
        />
        {showDebugOverlay ? (
          <SafeAreaView style={styles.debug}>
            <DebugOverlay
              values={debugValues}
              expanded={debugExpanded}
              history={debugHistory}
              minMax={debugMinMax}
              onToggle={() => setDebugExpanded((e) => !e)}
            />
          </SafeAreaView>
        ) : null}
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
  debug: {
    position: 'absolute',
  },
});
