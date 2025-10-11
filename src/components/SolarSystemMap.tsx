import { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer, TextureLoader } from 'expo-three';
import * as THREE from 'three';
import { Asset } from 'expo-asset';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { PinchGestureHandlerEventPayload } from 'react-native-gesture-handler';

import { colors } from '../styles/theme';
import { cBodies as PLANETS, Planet, earth } from '../planets';
import { Coordinates } from '../types';
import { getCurrentDate } from '../utils/time';
import { useCurrentPosition, useStore } from '../utils/store';

// Scale real KM to scene units (keeps numbers in a reasonable range)
const KM_TO_SCENE = 1 / 1e7; // 10,000,000 km => 1 scene unit
// Maximum trail length capped at 125 years (in days)
const MAX_TRAIL_DAYS = Math.floor(125 * 365.25);

function toVec3([x, y, z]: Coordinates): THREE.Vector3 {
  return new THREE.Vector3(x * KM_TO_SCENE, y * KM_TO_SCENE, z * KM_TO_SCENE);
}

function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function getTrailForPlanet(planet: Planet, daysBack: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const today = getCurrentDate();

  // Sample with a dynamic step so we never exceed ~1000 segments.
  // If stepping by 1 would produce >1000 segments, increase the step size.
  const MAX_SEGMENTS = 1000;
  const step = Math.max(1, Math.ceil(daysBack / MAX_SEGMENTS));
  for (let i = daysBack; i >= 1; i -= step) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = getDateKey(d);
    if (Object.prototype.hasOwnProperty.call(planet.dailyPositions, key)) {
      const coords = planet.dailyPositions[key]!;
      points.push(
        new THREE.Vector3(
          coords[0] * KM_TO_SCENE,
          coords[1] * KM_TO_SCENE,
          coords[2] * KM_TO_SCENE,
        ),
      );
    }
  }

  // Always include today's (current) position at the end if available
  const todayKey = getDateKey(today);
  if (Object.prototype.hasOwnProperty.call(planet.dailyPositions, todayKey)) {
    const todayCoords = planet.dailyPositions[todayKey]!;
    points.push(
      new THREE.Vector3(
        todayCoords[0] * KM_TO_SCENE,
        todayCoords[1] * KM_TO_SCENE,
        todayCoords[2] * KM_TO_SCENE,
      ),
    );
  }

  return points;
}

function createRocketMesh(): THREE.Group {
  const group = new THREE.Group();

  // Body
  const bodyGeom = new THREE.CylinderGeometry(0.2, 0.2, 1.2, 16);
  const bodyMat = new THREE.MeshBasicMaterial({
    color: parseInt(colors.accent.replace('#', '0x')),
  });

  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.y = 0;
  group.add(body);

  // Nose
  const noseGeom = new THREE.ConeGeometry(0.22, 0.4, 16);
  const noseMat = new THREE.MeshBasicMaterial({
    color: parseInt(colors.primary.replace('#', '0x')),
  });

  const nose = new THREE.Mesh(noseGeom, noseMat);
  nose.position.y = 0.8;
  group.add(nose);

  // Fins
  const finGeom = new THREE.BoxGeometry(0.05, 0.25, 0.25);
  const finMat = new THREE.MeshBasicMaterial({
    color: parseInt(colors.cosmic.replace('#', '0x')),
  });

  const fin1 = new THREE.Mesh(finGeom, finMat);
  fin1.position.set(0.18, -0.4, 0);
  const fin2 = fin1.clone();
  fin2.position.set(-0.18, -0.4, 0);
  const fin3 = fin1.clone();
  fin3.position.set(0, -0.4, 0.18);
  const fin4 = fin1.clone();
  fin4.position.set(0, -0.4, -0.18);
  group.add(fin1, fin2, fin3, fin4);

  // Orient rocket to point "up"
  group.rotation.z = Math.PI; // point nose upward in +Y

  return group;
}

const EARTH_SCENE_RADIUS = 0.5; // Keep Earth's visual radius the same as before
// Nonlinear compression exponent for apparent size scaling.
const SIZE_EXPONENT = 0.4;

function apparentScaleRatio(ratio: number): number {
  // Prevent degenerate values; compress dynamic range using power law
  const r = Math.max(ratio, 1e-6);
  return Math.pow(r, SIZE_EXPONENT);
}

function createPlanetMesh(
  name: string,
  color: number,
  radius: number,
): THREE.Mesh {
  const geom = new THREE.SphereGeometry(radius, 24, 24);
  const mat = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = name;
  return mesh;
}

function createTrailLine(
  points: THREE.Vector3[],
  color: number,
): THREE.Line | undefined {
  if (points.length < 2) return undefined;
  const geom = new THREE.BufferGeometry().setFromPoints(points);

  // Build a per-vertex alpha attribute that fades from 0 (oldest)
  // to ~0.85 (newest, closest to the body) to simulate motion.
  const n = points.length;
  const alphas = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 1; // 0 .. 1 from oldest to newest
    const eased = t * t; // ease-in for smoother tail
    alphas[i] = 0.85 * eased; // 0 -> 0.85
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
  const currentPosition = useCurrentPosition();
  const targetPosition = useStore((s) => s.userPosition.target?.position);

  // Keep latest current position in a ref so animation loop can read it without re-creating
  const latestUserPos = useRef<Coordinates>(currentPosition);
  useEffect(() => {
    latestUserPos.current = currentPosition;
  }, [currentPosition]);

  // Keep latest target position in a ref for use inside the render loop
  const latestTargetPos = useRef<Coordinates | undefined>(targetPosition);
  useEffect(() => {
    latestTargetPos.current = targetPosition;
  }, [targetPosition]);

  // Refs for scene graph
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number | null>(null);
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);

  const rocketRef = useRef<THREE.Group | null>(null);
  const planetRefs = useRef<Partial<Record<string, THREE.Mesh>>>({});

  // Simple orbit state (spherical coordinates around origin)
  const radiusRef = useRef(50);
  const yawRef = useRef(2); // phase angle for orbit within the plane
  // const pitchRef = useRef(2); // unused in planar orbit, retained for future controls

  const updateCamera = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    const r = radiusRef.current;
    const theta = yawRef.current; // orbit angle within the plane

    // Positions in scene units
    const sun = new THREE.Vector3(0, 0, 0);
    const user = rocketRef.current
      ? rocketRef.current.position.clone()
      : toVec3(latestUserPos.current);

    const target = toVec3(
      latestTargetPos.current ?? earth.getCurrentPosition(),
    );

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
    if (n.lengthSq() < 1e-8) {
      const a = user.clone().sub(sun);
      const helper =
        Math.abs(a.y) < 0.9
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0);

      n.copy(a.clone().cross(helper));
      if (n.lengthSq() < 1e-8) n.set(0, 1, 0);
    }

    n.normalize();

    // Orthonormal basis (U, V) spanning the plane
    let U = target.clone().sub(center);
    if (U.lengthSq() < 1e-8) {
      const helper =
        Math.abs(n.y) < 0.9
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0);

      U = helper.clone().cross(n);
    }

    U.normalize();
    const V = n.clone().cross(U).normalize();

    // Height above the plane (parallel and above). Scale with radius for consistent framing.
    const _height = r * 0.35;

    // Circular path within the plane
    const circleOffset = U.clone()
      .multiplyScalar(Math.cos(theta) * r)
      .add(V.clone().multiplyScalar(Math.sin(theta) * r));

    const desiredPos = center
      .clone()
      .add(n.clone().multiplyScalar(_height))
      .add(circleOffset);

    camera.position.copy(desiredPos);
    // Keep camera "up" aligned to plane normal to minimize roll
    camera.up.copy(n);

    // Look at the center of the plane to keep sun, user, and target framed
    camera.lookAt(center);
  }, []);

  // Pan gesture removed per request; camera now auto-rotates in the render loop.

  const pinchGesture = useMemo(() => {
    const MIN_R = 10;
    const MAX_R = 200;

    return Gesture.Pinch().onUpdate((e: PinchGestureHandlerEventPayload) => {
      const scale = e.scale; // 1 at start, >1 zoom out, <1 zoom in
      const newR = THREE.MathUtils.clamp(
        radiusRef.current / scale,
        MIN_R,
        MAX_R,
      );

      radiusRef.current = newR;
      updateCamera();
    });
  }, [updateCamera]);

  const composedGesture = useMemo(() => pinchGesture, [pinchGesture]);

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
      renderer.setClearColor(0x101018, 1);
      renderer.setPixelRatio(1);
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

        const skyGeometry = new THREE.SphereGeometry(1800, 48, 48);
        const skyMaterial = new THREE.MeshBasicMaterial({
          map: spaceTexture,
          side: THREE.BackSide,
          depthWrite: false,
        });

        const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);

        scene.add(skyMesh);
      } catch (e) {
        console.warn('[SolarSystemMap] Failed to load sky texture', e);
      }

      const camera = new THREE.PerspectiveCamera(
        60,
        drawingBufferWidth / drawingBufferHeight,
        0.1,
        2000,
      );

      cameraRef.current = camera;

      updateCamera();

      // Lights
      const ambient = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambient);
      const sunLight = new THREE.PointLight(0xffffff, 1.2, 0, 2);
      sunLight.position.set(0, 0, 0);
      scene.add(sunLight);

      // Rocket (user)
      const rocket = createRocketMesh();
      rocketRef.current = rocket;
      scene.add(rocket);

      PLANETS.forEach((p) => {
        // Scale each body's visual radius according to its real radius (km) relative to Earth,
        // apply an exponential clamp to compress extremes so giants shrink and dwarfs grow relatively.
        // Earth's displayed size remains unchanged. The Sun is kept modest for readability.
        const ratioToEarth = p.radiusKm / earth.radiusKm;
        const clampedRatio = apparentScaleRatio(ratioToEarth);
        const visualRadius = EARTH_SCENE_RADIUS * clampedRatio;

        const mesh = createPlanetMesh(p.name, p.color, visualRadius);
        planetRefs.current[p.name] = mesh;
        const pos = p.getCurrentPosition();
        mesh.position.copy(toVec3(pos));
        scene.add(mesh);

        if (p instanceof Planet) {
          const periodDays = Math.round(p.orbitalPeriodDays);
          const daysBack = Math.min(periodDays, MAX_TRAIL_DAYS);
          const trailPoints = getTrailForPlanet(p, daysBack);
          const trail = createTrailLine(trailPoints, p.color);
          if (trail) scene.add(trail);
        }
      });

      // Initial rocket position
      const initial = toVec3(latestUserPos.current);
      rocket.position.copy(initial);

      // Animation loop
      const renderLoop = () => {
        // Update dynamic positions
        // 1) User rocket follows latest position
        if (rocketRef.current) {
          const p = toVec3(latestUserPos.current);
          rocketRef.current.position.copy(p);
        }

        // 2) Update planet positions for today (in case date offset changes)
        PLANETS.forEach((p) => {
          const mesh = planetRefs.current[p.name];
          if (mesh) {
            const pos = p.getCurrentPosition();
            mesh.position.copy(toVec3(pos));
          }
        });

        // 4) Auto-rotate camera around the computed plane
        yawRef.current += 0.003;
        updateCamera();

        renderer.render(scene, camera);
        gl.endFrameEXP();
        frameRef.current = requestAnimationFrame(renderLoop);
      };

      frameRef.current = requestAnimationFrame(renderLoop);
    },
    [updateCamera],
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
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material.dispose();
            }
          } else if (obj instanceof THREE.Line) {
            obj.geometry.dispose();
            const mat = obj.material as THREE.Material;
            mat.dispose();
          }
        });
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, []);

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={styles.container}>
        <GLView
          style={styles.gl}
          msaaSamples={0}
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
