// react compiler is being used, avoid using useCallback or useMemo
import { useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
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
import { useIsFocused } from '@react-navigation/native';
import { useDebugValues } from '../hooks/useDebugValues';

// Modularized helpers/builders
import { toVec3 } from './solarsystem/helpers';
import { type MappedMaterial } from './solarsystem/builders';
import { loadBodyTextures } from './solarsystem/textures';
import { createSky } from './solarsystem/sky';
import {
  vantageForProgress,
  CameraController,
  clamp01,
  easeInOutCubic,
} from './solarsystem/camera';
import { Rocket } from './solarsystem/rocket';
import { CelestialBodyNode, BodyNodesRegistry } from './solarsystem/bodies';
import { getRelevantPlanetSystemsFor } from './solarsystem/relevance';
import { createComposer } from './solarsystem/postprocessing';
import { useComposedGesture } from './solarsystem/gestures';
import { addDefaultLights } from './solarsystem/lights';
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
} from './solarsystem/constants';
import { DebugOverlay } from './DebugOverlay';
import { SafeAreaView } from 'react-native-safe-area-context';

// [moved] Helpers moved to './solarsystem/helpers'.

// [moved] Texture loading moved to './solarsystem/textures'.

// [moved] Mesh builders moved to './solarsystem/builders'.

export function SolarSystemMap() {
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

  const rocketRef = useRef<Rocket | null>(null);
  const displayUserPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const skyRef = useRef<THREE.Mesh | null>(null);

  const showTextures = useStore((s) => s.showTextures);
  const showDebugOverlay = useStore((s) => s.showDebugOverlay);

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

  // [debug publishing provided by useDebugValues hook]

  // Determine which planet systems are relevant for rendering moons
  const getRelevantPlanetSystems = (): Set<string> => {
    const { startingLocation, target } = useStore.getState().userPosition;
    return getRelevantPlanetSystemsFor(startingLocation, target?.name, PLANETS);
  };

  // Determine which planets are unlocked (visible) at current level
  const getUnlockedBodies = (): Set<string> => {
    const level = calculateLevel(useStore.getState().totalXP);
    const set = new Set<string>();
    PLANETS.forEach((b) => {
      if (b instanceof Planet) {
        const ml = b.minLevel ?? 0;
        if (level >= ml) set.add(b.name);
      }
    });
    return set;
  };

  // Animation durations imported from constants

  // Helpers (imported from camera module)

  // When focused, drive animation timing from focus start or latest distance change
  const focusAnimStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (isFocusedValue) {
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

      const vStart = vantageForProgress(fromAbs);
      const vEnd = vantageForProgress(toAbs);

      // If start/target centers are very close in scene units, lock yaw side-on for the
      // entire scripted camera sequence to avoid ending up behind the parent body.
      const startBody =
        PLANETS.find((b) => b.name === startingLocation) ?? earth;
      const targetBody = PLANETS.find((b) => b.name === target?.name) ?? earth;
      const startCenter = toVec3(startBody.getVisualPosition());
      const targetCenter = toVec3(targetBody.getVisualPosition());
      const separation = startCenter.distanceTo(targetCenter);
      const lockSideOn = separation < YAW_SIDE_ON_DISTANCE_CUTOFF;
      const SIDE_YAW = Math.PI / 2;
      const vStartAdj = lockSideOn ? { ...vStart, yaw: SIDE_YAW } : vStart;
      const vEndAdj = lockSideOn ? { ...vEnd, yaw: SIDE_YAW } : vEnd;
      vantageStartRef.current = vStartAdj;
      vantageEndRef.current = vEndAdj;

      if (pending) {
        const controller = cameraControllerRef.current;
        if (controller) {
          controller.startScriptedCamera(
            start,
            controller.state,
            vStartAdj,
            vEndAdj,
          );
        } else {
          pendingScriptedStartRef.current = {
            nowTs: start,
            vantageStart: vStartAdj,
            vantageEnd: vEndAdj,
          };
        }
      } else {
        pendingScriptedStartRef.current = null;
      }
    } else {
      focusAnimStartRef.current = null;
    }
  }, [isFocusedValue]);

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

      const { initialDistance } = useStore.getState().userPosition;
      const denom =
        initialDistance && initialDistance > 0 ? initialDistance : 1;

      const fromAbs = clamp01((previousDistanceTraveledVal ?? 0) / denom);
      const toAbs = clamp01((distanceTraveledVal ?? 0) / denom);
      const vStart = vantageForProgress(fromAbs);
      const vEnd = vantageForProgress(toAbs);

      // Check separation again on distance change; if small, lock yaw side-on.
      const { startingLocation, target } = useStore.getState().userPosition;
      const startBody =
        PLANETS.find((b) => b.name === startingLocation) ?? earth;
      const targetBody = PLANETS.find((b) => b.name === target?.name) ?? earth;
      const startCenter = toVec3(startBody.getVisualPosition());
      const targetCenter = toVec3(targetBody.getVisualPosition());
      const separation = startCenter.distanceTo(targetCenter);
      const lockSideOn = separation < YAW_SIDE_ON_DISTANCE_CUTOFF;
      const SIDE_YAW = Math.PI / 2;
      const vStartAdj = lockSideOn ? { ...vStart, yaw: SIDE_YAW } : vStart;
      const vEndAdj = lockSideOn ? { ...vEnd, yaw: SIDE_YAW } : vEnd;
      vantageStartRef.current = vStartAdj;
      vantageEndRef.current = vEndAdj;

      const controller = cameraControllerRef.current;
      if (controller) {
        controller.startScriptedCamera(
          start,
          controller.state,
          vStartAdj,
          vEndAdj,
        );
      } else {
        pendingScriptedStartRef.current = {
          nowTs: start,
          vantageStart: vStartAdj,
          vantageEnd: vEndAdj,
        };
      }
    }

    // If values differ, an animation is pending; if equal, batch already synced
    animSyncedRef.current = previousDistanceTraveledVal === distanceTraveledVal;
    prevDistanceRef.current = {
      prev: previousDistanceTraveledVal,
      curr: distanceTraveledVal,
    };
  }, [distanceTraveledVal, previousDistanceTraveledVal]);

  const animAlphaRef = useRef(0);
  const animSyncedRef = useRef(true);

  const vantageStartRef = useRef<{ yaw: number; pitch: number } | null>(null);
  const vantageEndRef = useRef<{ yaw: number; pitch: number } | null>(null);

  const pendingScriptedStartRef = useRef<{
    nowTs: number;
    vantageStart: { yaw: number; pitch: number };
    vantageEnd: { yaw: number; pitch: number };
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
        isFocusedRef.current && !animSyncedRef.current;

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

      const targetBody = PLANETS.find((b) => b.name === target.name) ?? earth;

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

  // Double-tap: smoothly zoom camera to default radius
  const zoomCamera = () => {
    cameraControllerRef.current?.resetZoom();
  };

  // Gesture composition via hook (persists pan accumulators internally)
  const gesture = useComposedGesture({
    controllerRef: cameraControllerRef,
    width,
    height,
    onDoubleTap: zoomCamera,
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

    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      drawingBufferWidth / drawingBufferHeight,
      CAMERA_NEAR,
      CAMERA_FAR,
    );

    cameraRef.current = camera;
    // Create camera controller and start any pending scripted sequence
    cameraControllerRef.current = new CameraController(camera);
    if (pendingScriptedStartRef.current) {
      const p = pendingScriptedStartRef.current;
      cameraControllerRef.current.startScriptedCamera(
        p.nowTs,
        cameraControllerRef.current.state,
        p.vantageStart,
        p.vantageEnd,
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
    } catch (e) {
      console.warn('[SolarSystemMap] Failed to create Rocket, skipping model');
      console.warn(e);
    }

    const relevantSystems = getRelevantPlanetSystems();
    const unlockedBodies = getUnlockedBodies();

    // Create body nodes with encapsulated mesh/trail/outline behavior
    const resolution = new THREE.Vector2(
      drawingBufferWidth,
      drawingBufferHeight,
    );

    PLANETS.forEach((p) => {
      const texture = showTextures ? texturesByName[p.name] : undefined;
      const node = new CelestialBodyNode({
        body: p,
        scene,
        camera,
        composer,
        resolution,
        texture,
        initialTrailsEnabled: useStore.getState().showTrails,
      });

      // Set initial visibility to reduce flicker before first update()
      if (p instanceof Moon) {
        node.setVisible(relevantSystems.has(p.orbits));
      } else if (p instanceof Planet) {
        node.setVisible(unlockedBodies.has(p.name));
      }

      bodyRegistryRef.current.add(node);
    });

    // (Final copy pass is added in createComposer)

    // Animation loop
    const renderLoop = () => {
      const { showTrails } = useStore.getState();

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

          const targetBody =
            PLANETS.find((b) => b.name === target.name) ?? earth;

          const startCenter = toVec3(startBody.getVisualPosition());
          const targetCenter = toVec3(targetBody.getVisualPosition());

          const aimPos = Rocket.computeAimPosition(
            startCenter,
            targetCenter,
            getVisualRadius(targetBody.name),
          );

          // Only spin/move/exhaust when a travel animation is pending
          const shouldAnimateTravel =
            isFocusedRef.current && !animSyncedRef.current;

          rocketRef.current.update(
            displayUserPosRef.current,
            aimPos,
            shouldAnimateTravel,
            animAlphaRef.current,
          );
        }
      }

      // Update all body nodes (positions, visibility, trails, outline fade)
      {
        const relevantSystemsNow = getRelevantPlanetSystems();
        const glCtx = glRef.current;
        if (glCtx) {
          const unlockedBodiesNow = getUnlockedBodies();
          bodyRegistryRef.current.forEach((node) =>
            node.update({
              glHeight: glCtx.drawingBufferHeight,
              relevantSystems: relevantSystemsNow,
              showTrails,
              unlockedBodies: unlockedBodiesNow,
            }),
          );
        }
      }

      // CameraController: compute center/target and tick
      {
        const controller = cameraControllerRef.current;
        const cam = cameraRef.current;
        if (controller && cam) {
          const { target: targetState, startingLocation } =
            useStore.getState().userPosition;
          const targetBody =
            PLANETS.find((b) => b.name === targetState?.name) ?? earth;
          const startBody =
            PLANETS.find((b) => b.name === startingLocation) ?? earth;

          const center = displayUserPosRef.current.clone();
          const targetVisual = targetState
            ? toVec3(targetBody.getVisualPosition())
            : center.clone();

          // Disable auto-rotate during short-hop animations so yaw stays locked.
          let autoRotate = true;
          if (targetState) {
            const startCenter = toVec3(startBody.getVisualPosition());
            const separation = startCenter.distanceTo(targetVisual);
            const lockSideOn = separation < YAW_SIDE_ON_DISTANCE_CUTOFF;
            const animActive = isFocusedRef.current && !animSyncedRef.current;
            if (lockSideOn && animActive) autoRotate = false;
          }

          controller.tick(center, targetVisual, {
            nowTs: getCurrentTime(),
            autoRotate,
          });
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

      // (Outline fade handled within CelestialBodyNode.update)

      let fps = 0;
      const frameStart = performance.now();
      if (isFocusedRef.current) {
        if (composerRef.current) {
          composerRef.current.render();
        } else {
          renderer.render(scene, camera);
        }

        const elapsed = performance.now() - frameStart;
        fps = elapsed > 0 ? 1000 / elapsed : 0;
      }

      // Collect debug metrics and publish via single function
      {
        const controller = cameraControllerRef.current;
        const state = controller?.state;
        const yaw = state?.yaw ?? 0;
        const pitch = state?.pitch ?? 0;
        const animAlpha = animAlphaRef.current;
        publishDebug({ fps, yaw, pitch, animAlpha });
      }

      gl.endFrameEXP();
      frameRef.current = requestAnimationFrame(renderLoop);
    };

    frameRef.current = requestAnimationFrame(renderLoop);
  };

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
    }
  }, [width, height]);

  // Cleanup
  useEffect(() => {
    console.log('[SolarSystemMap] mounted');
    const registryAtMount = bodyRegistryRef.current;
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
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
      <View style={styles.container}>
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
