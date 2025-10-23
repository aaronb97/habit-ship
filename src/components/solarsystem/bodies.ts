import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

import {
  createPlanetMesh,
  createTrailLine,
  type MappedMaterial,
  createSaturnRings,
} from './builders';
import {
  CBODY_RADIUS_MULTIPLIER,
  PLANET_MESH_X_ROTATION,
  OUTLINE_EDGE_GLOW,
  OUTLINE_EDGE_THICKNESS,
  OUTLINE_PULSE_PERIOD,
  OUTLINE_INTENSITY_SMOOTHING,
  OUTLINE_EDGE_STRENGTH,
  OUTLINE_MIN_ENABLED_FACTOR,
  OUTLINE_MIN_PIXELS_FADE_OUT,
  OUTLINE_MIN_PIXELS_FADE_IN,
  TRAIL_NEAR_BODY_DIAMETERS,
} from './constants';
import { toVec3, apparentScaleRatio, getTrailForBody } from './helpers';
import { CBody, Planet, Moon, earth } from '../../planets';
import { useStore } from '../../utils/store';

export type BodyNodeUpdateOpts = {
  glHeight: number;
  relevantSystems: Set<string>;
  showTrails: boolean;
  unlockedBodies: Set<string>;
  visitedBodies: Set<string>;
  startingLocation: string;
  targetName?: string;
};

export class CelestialBodyNode {
  public readonly body: CBody;
  public readonly mesh: THREE.Mesh;
  public readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private outlinePass?: OutlinePass;
  private outlineIntensity = 0;
  private trail?: THREE.Line;
  private trailComputedAtPos?: THREE.Vector3;
  private disposed = false;
  private outlineGlobalEnabled = true;
  private unsubOutlines?: () => void;

  // Cache visual radius on creation (in scene units before mesh scaling)
  private readonly visualRadiusBase: number;

  constructor(params: {
    body: CBody;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    composer: EffectComposer;
    resolution: THREE.Vector2;
    texture?: THREE.Texture;
    ringTexture?: THREE.Texture;
    hasOutline?: boolean; // default true for Planet/Moon, false for Star
    initialTrailsEnabled?: boolean;
  }) {
    const { body, scene, camera, composer, resolution, texture } = params;
    this.body = body;
    this.scene = scene;
    this.camera = camera;
    this.outlineGlobalEnabled = Boolean(
      useStore.getState().outlinesBodiesEnabled,
    );

    // Compute apparent visual radius
    const radiusKm = Math.max(100, body.radiusKm);
    const ratioToEarth = radiusKm / earth.radiusKm;
    const clampedRatio = apparentScaleRatio(ratioToEarth);
    this.visualRadiusBase = CBODY_RADIUS_MULTIPLIER * clampedRatio;

    // Build mesh (sphere for all c-bodies; Sun uses basic material inside builder)
    this.mesh = createPlanetMesh(body, this.visualRadiusBase, texture);

    // Optional: attach rings for Saturn if a ring texture is provided
    let ringMesh: THREE.Mesh | undefined;
    if (body.name === 'Saturn' && params.ringTexture) {
      try {
        ringMesh = createSaturnRings(this.visualRadiusBase, params.ringTexture);
        this.mesh.add(ringMesh);
      } catch {}
    }

    // Orientation: align equator horizontally, then apply axial tilt
    this.mesh.rotation.x = PLANET_MESH_X_ROTATION;
    const tiltDeg = body.axialTiltDeg ?? 0;
    if (tiltDeg !== 0) {
      this.mesh.rotation.z += THREE.MathUtils.degToRad(tiltDeg);
    }

    // Randomize static spin phase around local Y to avoid identical texture seams
    const randomPhase = Math.random() * Math.PI * 2;
    this.mesh.rotateOnAxis(new THREE.Vector3(0, 1, 0), randomPhase);

    // Initial position
    this.mesh.position.copy(toVec3(body.getVisualPosition()));

    // Add to scene
    scene.add(this.mesh);

    // Outline for planets and moons (optional for stars)
    const hasOutline =
      params.hasOutline ?? (body instanceof Planet || body instanceof Moon);

    if (hasOutline) {
      const pass = new OutlinePass(
        new THREE.Vector2(resolution.x, resolution.y),
        scene,
        camera,
        [this.mesh],
      );

      pass.edgeStrength = 0; // start hidden; we fade in based on screen size
      pass.edgeGlow = OUTLINE_EDGE_GLOW;
      pass.edgeThickness = OUTLINE_EDGE_THICKNESS;
      pass.pulsePeriod = OUTLINE_PULSE_PERIOD;
      pass.visibleEdgeColor.set(body.color);
      pass.hiddenEdgeColor.set(0);
      pass.enabled = false;
      composer.addPass(pass);
      this.outlinePass = pass;
    }

    {
      type RootState = ReturnType<typeof useStore.getState>;
      const unsub = useStore.subscribe((s: RootState, _prev: RootState) => {
        this.outlineGlobalEnabled = Boolean(s.outlinesBodiesEnabled);
        if (this.outlinePass) {
          if (!this.mesh.visible) {
            this.outlinePass.enabled = false;
          } else {
            const enabled =
              this.outlineGlobalEnabled &&
              this.outlineIntensity > OUTLINE_MIN_ENABLED_FACTOR;

            this.outlinePass.enabled = enabled;
          }
        }
      });

      this.unsubOutlines = unsub;
    }

    // Trails optionally created for Planets and Moons
    if (
      params.initialTrailsEnabled &&
      (body instanceof Planet || body instanceof Moon)
    ) {
      const pts = getTrailForBody(body);
      const nearFade = 2 * this.getVisualRadius() * TRAIL_NEAR_BODY_DIAMETERS;
      const line = createTrailLine(pts, body.color, nearFade);
      if (line) {
        scene.add(line);
        this.trail = line;
      }
    }
  }

  setResolution(res: THREE.Vector2) {
    if (this.outlinePass) {
      this.outlinePass.resolution.set(res.x, res.y);
    }
  }

  setVisible(visible: boolean) {
    this.mesh.visible = visible;
    if (this.trail) {
      this.trail.visible = visible && this.trail.visible;
    } // preserve if previously hidden

    if (this.outlinePass) {
      if (!visible) {
        this.outlineIntensity = 0;
        this.outlinePass.edgeStrength = 0;
        this.outlinePass.enabled = false;
      } else {
        const enabled =
          this.outlineGlobalEnabled &&
          this.outlineIntensity > OUTLINE_MIN_ENABLED_FACTOR;

        this.outlinePass.enabled = enabled;
      }
    }
  }

  setTrailsEnabled(enabled: boolean) {
    if (!(this.body instanceof Planet || this.body instanceof Moon)) {
      return;
    }

    if (enabled) {
      if (!this.trail) {
        const pts = getTrailForBody(this.body);
        const nearFade = 2 * this.getVisualRadius() * TRAIL_NEAR_BODY_DIAMETERS;
        const line = createTrailLine(pts, this.body.color, nearFade);
        if (line) {
          this.scene.add(line);
          this.trail = line;
          // Cache the position at which the trail was computed
          this.trailComputedAtPos = this.mesh.position.clone();
        }
      }
    }

    if (this.trail) {
      this.trail.visible = enabled && this.mesh.visible;
    }
  }

  getVisualRadius(): number {
    return this.visualRadiusBase * this.mesh.scale.x;
  }

  update(opts: BodyNodeUpdateOpts) {
    if (this.disposed) {
      return;
    }

    // Update position to current visual position (accounts for date/time changes)
    this.mesh.position.copy(toVec3(this.body.getVisualPosition()));

    // Update trail visibility (and lazily create if needed)
    if (this.body instanceof Moon) {
      const allowed = opts.relevantSystems.has(this.body.orbits);
      this.mesh.visible = allowed;
      this.setTrailsEnabled(opts.showTrails && allowed);
    } else if (this.body instanceof Planet) {
      const always = Boolean(this.body.alwaysRenderIfDiscovered);
      const isVisited = opts.visitedBodies.has(this.body.name);
      const isStart = this.body.name === opts.startingLocation;
      const isTarget = this.body.name === opts.targetName;
      const isUnlocked = opts.unlockedBodies.has(this.body.name);
      const allowed = always
        ? isUnlocked || isVisited || isStart || isTarget
        : isVisited || isStart || isTarget;
      this.mesh.visible = allowed;
      this.setTrailsEnabled(opts.showTrails && allowed);
    } else {
      // e.g., Sun — no trails
      this.mesh.visible = true;
      if (this.trail) {
        this.trail.visible = false;
      }
    }

    // Keep trails in sync with current visual position without excess recompute.
    // If we've moved more than one visual radius from the position used to build
    // the trail, rebuild the trail and cache the new position. Log when it occurs.
    if (
      (this.body instanceof Planet || this.body instanceof Moon) &&
      this.trail &&
      this.trail.visible
    ) {
      const currentPos = this.mesh.position;
      if (!this.trailComputedAtPos) {
        this.trailComputedAtPos = currentPos.clone();
      } else {
        const dist = currentPos.distanceTo(this.trailComputedAtPos);
        const threshold = this.getVisualRadius();
        if (dist > threshold) {
          // Dispose old trail
          this.scene.remove(this.trail);
          this.trail.geometry.dispose();
          (this.trail.material as THREE.Material).dispose();

          // Rebuild
          const pts = getTrailForBody(this.body);
          const nearFade =
            2 * this.getVisualRadius() * TRAIL_NEAR_BODY_DIAMETERS;

          const line = createTrailLine(pts, this.body.color, nearFade);
          if (line) {
            this.scene.add(line);
            this.trail = line;
            this.trail.visible = this.mesh.visible && opts.showTrails;
            this.trailComputedAtPos = currentPos.clone();
            console.log(
              `[CelestialBodyNode] Rebuilt trail for ${
                this.body.name
              } (dist=${dist.toFixed(4)}, threshold=${threshold.toFixed(
                4,
              )}) @ ${new Date().toISOString()}`,
            );
          } else {
            this.trail = undefined;
            this.trailComputedAtPos = undefined;
          }
        }
      }
    }

    // Outline intensity based on screen-space size
    if (this.outlinePass && this.mesh.visible) {
      const cam = this.camera;
      const heightPx = Math.max(1, opts.glHeight);
      const vFovRad = (cam.fov * Math.PI) / 180;
      const r = this.getVisualRadius();
      const d = cam.position.distanceTo(this.mesh.position);
      const heightWorld = 2 * d * Math.tan(vFovRad / 2);
      const px = (r / Math.max(1e-6, heightWorld)) * heightPx;

      // Fade between two pixel thresholds stored in constants
      const START = OUTLINE_MIN_PIXELS_FADE_OUT;
      const END = OUTLINE_MIN_PIXELS_FADE_IN;
      const target = THREE.MathUtils.clamp((px - START) / (END - START), 0, 1);

      this.outlineIntensity =
        this.outlineIntensity +
        (target - this.outlineIntensity) * OUTLINE_INTENSITY_SMOOTHING;

      const strength = OUTLINE_EDGE_STRENGTH * this.outlineIntensity;
      this.outlinePass.edgeStrength = strength;
      this.outlinePass.enabled =
        this.outlineGlobalEnabled &&
        this.outlineIntensity > OUTLINE_MIN_ENABLED_FACTOR;
    } else if (this.outlinePass) {
      // Invisible mesh => disable outline
      this.outlineIntensity = 0;
      this.outlinePass.edgeStrength = 0;
      this.outlinePass.enabled = false;
    }
  }

  dispose() {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Remove and dispose trail
    if (this.trail) {
      this.scene.remove(this.trail);
      this.trail.geometry.dispose();
      const mat = this.trail.material as THREE.Material;
      mat.dispose();
      this.trail = undefined;
    }

    // Remove mesh from scene and dispose resources
    this.scene.remove(this.mesh);
    // Dispose child meshes we created explicitly (e.g., rings)
    try {
      const child = this.mesh.getObjectByName('SaturnRings');
      if (child && child instanceof THREE.Mesh) {
        const cm = child.material as MappedMaterial;
        if (cm.map) {
          cm.map.dispose();
        }
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    } catch {}
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach((m) => {
        const mm = m as MappedMaterial;
        if (mm.map) {
          mm.map.dispose();
        }

        (m as THREE.Material).dispose();
      });
    } else {
      const mm = this.mesh.material as MappedMaterial;
      if (mm.map) {
        mm.map.dispose();
      }

      (this.mesh.material as THREE.Material).dispose();
    }

    // OutlinePass is owned by the composer; it will be disposed with composer.dispose().
    // We can still disable and clear references.
    if (this.outlinePass) {
      this.outlinePass.enabled = false;
      // No removePass API on EffectComposer; rely on composer.dispose() later.
      this.outlinePass = undefined;
    }

    if (this.unsubOutlines) {
      try {
        this.unsubOutlines();
      } catch {}

      this.unsubOutlines = undefined;
    }

    this.trailComputedAtPos = undefined;
  }
}

export class BodyNodesRegistry {
  private nodes = new Map<string, CelestialBodyNode>();

  add(node: CelestialBodyNode) {
    this.nodes.set(node.body.name, node);
  }

  get(name: string): CelestialBodyNode | undefined {
    return this.nodes.get(name);
  }

  forEach(cb: (node: CelestialBodyNode) => void) {
    this.nodes.forEach(cb);
  }

  setResolution(res: THREE.Vector2) {
    this.nodes.forEach((n) => n.setResolution(res));
  }

  getVisualRadius(name: string): number {
    return this.nodes.get(name)?.getVisualRadius() ?? 0;
  }

  disposeAll() {
    this.nodes.forEach((n) => n.dispose());
    this.nodes.clear();
  }
}
