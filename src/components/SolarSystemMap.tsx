import { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, useWindowDimensions, StyleSheet } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { PinchGestureHandlerEventPayload } from 'react-native-gesture-handler';

import { colors } from '../styles/theme';
import { planets as PLANETS, Planet } from '../planets';
import { Coordinates } from '../types';
import { getCurrentDate } from '../utils/time';
import { useCurrentPosition } from '../utils/store';

// Scale real KM to scene units (keeps numbers in a reasonable range)
const KM_TO_SCENE = 1 / 1e7; // 10,000,000 km => 1 scene unit

function toVec3({ x, y, z }: Coordinates): THREE.Vector3 {
  return new THREE.Vector3(x * KM_TO_SCENE, y * KM_TO_SCENE, z * KM_TO_SCENE);
}

function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getTrailForPlanet(planet: Planet, daysBack: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const today = getCurrentDate();

  for (let i = daysBack; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = getDateKey(d);
    if (Object.prototype.hasOwnProperty.call(planet.dailyPositions, key)) {
      const coords = planet.dailyPositions[key] as number[];
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
    const todayCoords = planet.dailyPositions[todayKey] as number[];
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

function createPlanetMesh(name: string, color: number): THREE.Mesh {
  const radius = 0.5; // uniform radius for now
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
  const mat = new THREE.LineBasicMaterial({ color, linewidth: 1 });
  const line = new THREE.Line(geom, mat);
  return line;
}

export function SolarSystemMap() {
  const { width, height } = useWindowDimensions();
  const currentPosition = useCurrentPosition();

  // Keep latest current position in a ref so animation loop can read it without re-creating
  const latestUserPos = useRef<Coordinates>(currentPosition);
  useEffect(() => {
    latestUserPos.current = currentPosition;
  }, [currentPosition]);

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
  const yawRef = useRef(2); // horizontal angle, radians
  const pitchRef = useRef(2); // vertical angle, radians

  const updateCamera = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const r = radiusRef.current;
    const yaw = yawRef.current;
    const pitch = pitchRef.current;

    const x = r * Math.cos(pitch) * Math.sin(yaw);
    const y = r * Math.sin(pitch);
    const z = r * Math.cos(pitch) * Math.cos(yaw);

    camera.position.set(x, y, z);

    if (rocketRef.current) {
      camera.lookAt(rocketRef.current.position);
    }
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

      // Sun (at origin)
      const sunGeom = new THREE.SphereGeometry(2.0, 32, 32);
      const sunMat = new THREE.MeshBasicMaterial({ color: 0xffd27f });
      const sun = new THREE.Mesh(sunGeom, sunMat);
      sun.position.set(0, 0, 0);
      scene.add(sun);

      // Debug axes to ensure something is visible even without planets
      const axes = new THREE.AxesHelper(5);
      scene.add(axes);
      const grid = new THREE.GridHelper(100, 20, 0x444444, 0x222222);
      (grid.material as THREE.Material).transparent = true;
      grid.position.y = -2;
      scene.add(grid);

      // Rocket (user)
      const rocket = createRocketMesh();
      rocketRef.current = rocket;
      scene.add(rocket);

      // Planets + trails
      const planetColorMap: Record<string, number> = {
        Mercury: 0xb0b0b0,
        Venus: 0xffdd99,
        Earth: 0x6aa7ff,
        'The Moon': 0xcccccc,
        Mars: 0xff6a5e,
      };

      PLANETS.forEach((p) => {
        const color = planetColorMap[p.name] ?? 0xffffff;
        const mesh = createPlanetMesh(p.name, color);
        planetRefs.current[p.name] = mesh;
        const pos = p.getCurrentPosition();
        mesh.position.copy(toVec3(pos));
        scene.add(mesh);

        const trailPoints = getTrailForPlanet(p, 60); // last 60 days
        const trail = createTrailLine(trailPoints, color);
        if (trail) scene.add(trail);
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

        // 4) Auto-rotate camera around origin
        yawRef.current += 0.003;
        updateCamera();

        renderer.render(scene, camera);
        gl.endFrameEXP();
        frameRef.current = requestAnimationFrame(renderLoop);
      };

      frameRef.current = requestAnimationFrame(renderLoop);
    },
    [height, width, updateCamera],
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
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>
            SolarSystemMap
          </Text>
        </View>
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
