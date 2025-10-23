import * as THREE from 'three';
import {
  SPHERE_SEGMENTS,
  PLANET_MESH_X_ROTATION,
  TRAIL_MAX_ALPHA,
  TRAIL_EASE_EXPONENT,
  TRAIL_NEAR_BODY_FADE_EXPONENT,
} from './constants';
import { CBody } from '../../planets';

export type MappedMaterial =
  | THREE.MeshBasicMaterial
  | THREE.MeshLambertMaterial
  | THREE.MeshPhongMaterial;

export type PlanetMeshUserData = {
  visualRadius?: number;
};

export function createPlanetMesh(
  body: CBody,
  radius: number,
  texture?: THREE.Texture,
): THREE.Mesh {
  const { name, color, axialTiltDeg } = body;
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

/**
 * Create a textured ring mesh sized relative to a planet's visual radius.
 * @param planetRadius Visual radius of the planet (scene units)
 * @param texture The ring texture with transparency (e.g., saturn_rings.png)
 */
export function createSaturnRings(
  planetRadius: number,
  texture: THREE.Texture,
): THREE.Mesh {
  // Approximate inner/outer radii of Saturn's main rings
  const inner = planetRadius * 1.2;
  const outer = planetRadius * 2.3;

  const geom = new THREE.RingGeometry(inner, outer, 64, 1);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    alphaTest: 0.3,
  });

  const ring = new THREE.Mesh(geom, mat);
  ring.rotation.x = Math.PI / 2;
  ring.name = 'SaturnRings';
  // No local rotation: inherits parent's equatorial tilt/orientation
  return ring;
}

export function createTrailLine(
  points: THREE.Vector3[],
  color: number,
  nearFadeDistance: number,
): THREE.Line | undefined {
  if (points.length < 2) {
    return undefined;
  }

  const geom = new THREE.BufferGeometry().setFromPoints(points);

  // Build a per-vertex alpha attribute that fades from 0 (oldest)
  // to ~TRAIL_MAX_ALPHA (newest, closest to the body) to simulate motion.
  const n = points.length;
  const alphas = new Float32Array(n);
  const last = points[n - 1]!;
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 1; // 0 .. 1 from oldest to newest
    const eased = Math.pow(t, TRAIL_EASE_EXPONENT); // ease-in for smoother tail
    const base = TRAIL_MAX_ALPHA * eased; // 0 -> max alpha
    let nearFactor = 1.0;
    if (nearFadeDistance > 0) {
      const p = points[i]!;
      const dist = p.distanceTo(last);
      const k = THREE.MathUtils.clamp(dist / nearFadeDistance, 0.0, 1.0);
      nearFactor = Math.pow(k, TRAIL_NEAR_BODY_FADE_EXPONENT);
    }

    alphas[i] = base * nearFactor;
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
