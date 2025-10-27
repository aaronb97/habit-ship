import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Asset } from 'expo-asset';
import {
  DEFAULT_ROCKET_FORWARD,
  ROCKET_MODEL_SCALE,
  ROCKET_SPIN_SPEED,
  ROCKET_LANDING_CLEARANCE,
  OUTLINE_EDGE_GLOW,
  OUTLINE_EDGE_THICKNESS,
  OUTLINE_PULSE_PERIOD,
  OUTLINE_EDGE_STRENGTH,
  ROCKET_EXHAUST_SCALE,
  ROCKET_MIN_SCREEN_PIXELS,
} from './constants';
import { useStore } from '../../utils/store';
import { getSkinById } from '../../utils/skins';

// Apply per-part materials/colors to the loaded rocket model
// useBasic: If true, uses MeshBasicMaterial for all non-window parts to avoid lighting cost.
function applyRocketMaterials(
  obj: THREE.Group,
  baseColor: number,
  useBasic: boolean,
) {
  const base = new THREE.Color(baseColor);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  // Darker variant for non-body, non-window parts
  const altL = Math.max(0, Math.min(1, hsl.l - 0.2));

  const hours = new Date().getHours();
  const isDaytime = hours >= 8 && hours <= 20;

  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const name = child.name || '';
      if (name.includes('Window')) {
        const mat = new THREE.MeshBasicMaterial();
        mat.color.set(isDaytime ? 0xfff8e3 : 0x000000);
        child.material = mat;
      } else if (name.includes('Body')) {
        const mat = useBasic
          ? new THREE.MeshBasicMaterial()
          : new THREE.MeshStandardMaterial();
        mat.color.set(base);
        child.material = mat;
      } else {
        const mat = useBasic
          ? new THREE.MeshBasicMaterial()
          : new THREE.MeshStandardMaterial();
        const other = new THREE.Color();
        other.setHSL(hsl.h, hsl.s, altL);
        mat.color.set(other);
        child.material = mat;
      }
    }
  });
}

// ==========================
// Rocket class (encapsulated)
// ==========================
type CreateArgs = {
  color: number;
  scene: THREE.Scene;
  camera: THREE.Camera;
  composer: EffectComposer;
  resolution: THREE.Vector2;
  /** If true, do not create an OutlinePass for this rocket. Defaults to false. */
  withoutOutline?: boolean;
  /** If true, use MeshBasicMaterial for hull/parts instead of lit materials. Defaults to false. */
  useBasicMaterials?: boolean;
};

export class Rocket {
  public readonly group: THREE.Group;
  private readonly hull: THREE.Group;
  private readonly exhaustGroup: THREE.Group;
  private outlinePass?: OutlinePass;
  private spinAngle = 0;
  private outlineGlobalEnabled = true;
  private unsubOutlines?: () => void;
  private baseColor: number;
  private currentTexture?: THREE.Texture | null;
  private uvsApplied = false;
  private centerOffset: THREE.Vector3 = new THREE.Vector3();
  private baseBoundingRadius: number = 0;
  private readonly useBasicMaterials: boolean;

  // exhaust sprites
  private sprites: THREE.Sprite[] = [];
  private pool: THREE.Sprite[] = [];
  private readonly maxSprites = 120;

  private constructor(
    group: THREE.Group,
    hull: THREE.Group,
    exhaustGroup: THREE.Group,
    outlinePass: OutlinePass | undefined,
    baseColor: number,
    useBasicMaterials: boolean,
  ) {
    this.group = group;
    this.hull = hull;
    this.exhaustGroup = exhaustGroup;
    this.outlinePass = outlinePass;
    this.baseColor = baseColor;
    this.useBasicMaterials = useBasicMaterials;
    this.outlineGlobalEnabled = Boolean(
      useStore.getState().outlinesRocketEnabled,
    );

    if (this.outlinePass) {
      this.outlinePass.enabled =
        this.outlineGlobalEnabled && this.group.visible;
    }

    {
      type RootState = ReturnType<typeof useStore.getState>;
      const unsub = useStore.subscribe((s: RootState, _prev: RootState) => {
        this.outlineGlobalEnabled = Boolean(s.outlinesRocketEnabled);
        if (this.outlinePass) {
          this.outlinePass.enabled =
            this.outlineGlobalEnabled && this.group.visible;
        }
      });

      this.unsubOutlines = unsub;
    }

    this.hull.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(this.hull);
    const ctrWorld = new THREE.Vector3();
    box.getCenter(ctrWorld);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    this.baseBoundingRadius = sphere.radius;
    this.group.updateWorldMatrix(true, false);
    const ctrLocal = this.group.worldToLocal(ctrWorld.clone());
    this.centerOffset.copy(ctrLocal);
  }

  private ensureCylindricalUVsApplied() {
    if (this.uvsApplied) return;

    // Compute global bounds over all Body meshes to normalize V consistently
    const bounds = {
      min: new THREE.Vector3(+Infinity, +Infinity, +Infinity),
      max: new THREE.Vector3(-Infinity, -Infinity, -Infinity),
    };
    const bodyMeshes: THREE.Mesh[] = [];
    // Make sure world matrices are up-to-date
    this.hull.updateWorldMatrix(true, true);
    this.hull.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const name = child.name || '';
        if (name.includes('Body')) {
          bodyMeshes.push(child);
          const geom = child.geometry as THREE.BufferGeometry;
          const pos = geom.attributes.position as THREE.BufferAttribute;
          const arr = pos.array as ArrayLike<number>;
          for (let i = 0; i < pos.count; i++) {
            const lx = arr[i * 3 + 0]!;
            const ly = arr[i * 3 + 1]!;
            const lz = arr[i * 3 + 2]!;
            const wp = new THREE.Vector3(lx, ly, lz).applyMatrix4(
              child.matrixWorld,
            );
            if (wp.x < bounds.min.x) bounds.min.x = wp.x;
            if (wp.y < bounds.min.y) bounds.min.y = wp.y;
            if (wp.z < bounds.min.z) bounds.min.z = wp.z;
            if (wp.x > bounds.max.x) bounds.max.x = wp.x;
            if (wp.y > bounds.max.y) bounds.max.y = wp.y;
            if (wp.z > bounds.max.z) bounds.max.z = wp.z;
          }
        }
      }
    });

    // Choose height axis as the largest extent
    const extents = new THREE.Vector3().subVectors(bounds.max, bounds.min);
    let heightAxis = 1; // y by default
    if (extents.x >= extents.y && extents.x >= extents.z) heightAxis = 0;
    else if (extents.z >= extents.y && extents.z >= extents.x) heightAxis = 2;

    const radialA = (heightAxis + 1) % 3;
    const radialB = (heightAxis + 2) % 3;
    const minH = [bounds.min.x, bounds.min.y, bounds.min.z][heightAxis]!;
    const rangeH = Math.max(
      1e-6,
      [extents.x, extents.y, extents.z][heightAxis]!,
    );

    // Apply cylindrical UVs per body mesh
    for (const mesh of bodyMeshes) {
      const geom = mesh.geometry as THREE.BufferGeometry;
      const pos = geom.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as ArrayLike<number>;
      const uvs = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        const lx = arr[i * 3 + 0]!;
        const ly = arr[i * 3 + 1]!;
        const lz = arr[i * 3 + 2]!;
        const wp = new THREE.Vector3(lx, ly, lz).applyMatrix4(mesh.matrixWorld);
        const comp = [wp.x, wp.y, wp.z] as const;
        const ra = comp[radialA]!;
        const rb = comp[radialB]!;
        const h = comp[heightAxis]!;
        const theta = Math.atan2(rb, ra);
        let u = theta / (Math.PI * 2) + 0.5;
        if (u < 0) u += 1; // wrap
        const v = (h - minH) / rangeH;
        uvs[i * 2 + 0] = u;
        uvs[i * 2 + 1] = v;
      }
      const uvAttr = new THREE.BufferAttribute(uvs, 2);
      geom.setAttribute('uv', uvAttr);
      uvAttr.needsUpdate = true;
    }

    this.uvsApplied = true;
  }

  /**
   * Creates a Rocket instance and optionally configures an OutlinePass.
   * @param color 24-bit integer base color for the rocket materials and outline.
   * @param scene THREE.Scene to attach post-processing and meshes to.
   * @param camera Active camera used for OutlinePass configuration.
   * @param composer EffectComposer where the OutlinePass (if any) will be added.
   * @param resolution Current renderer resolution in pixels.
   * @param withoutOutline When true, skips creating an OutlinePass (useful for friend rockets).
   * @param useBasicMaterials When true, uses MeshBasicMaterial for hull/parts (unlit, cheaper).
   */
  static async create({
    color,
    scene,
    camera,
    composer,
    resolution,
    withoutOutline = false,
    useBasicMaterials = false,
  }: CreateArgs): Promise<Rocket> {
    // Ensure base model is preloaded once, then clone it for this instance
    await Rocket.preloadModel();
    const obj = Rocket.cloneBaseModel();
    // Apply default orientation expected by the scene (nose along +Z)
    obj.rotation.x = THREE.MathUtils.degToRad(-90);

    applyRocketMaterials(obj, color, Boolean(useBasicMaterials));

    obj.scale.setScalar(ROCKET_MODEL_SCALE);

    const root = new THREE.Group();
    const exhaust = new THREE.Group();
    root.add(obj);
    root.add(exhaust);

    // Outline just the hull (not the exhaust)
    let outline: OutlinePass | undefined;
    if (!withoutOutline) {
      outline = new OutlinePass(
        resolution.clone(),
        scene,
        camera as THREE.PerspectiveCamera,
        [obj],
      );

      outline.edgeStrength = OUTLINE_EDGE_STRENGTH;
      outline.edgeGlow = OUTLINE_EDGE_GLOW;
      outline.edgeThickness = OUTLINE_EDGE_THICKNESS;
      outline.pulsePeriod = OUTLINE_PULSE_PERIOD;
      outline.visibleEdgeColor.set(color);
      outline.hiddenEdgeColor.set(color);
      outline.enabled = Boolean(useStore.getState().outlinesRocketEnabled);
      composer.addPass(outline);
    }

    return new Rocket(
      root,
      obj,
      exhaust,
      outline,
      color,
      Boolean(useBasicMaterials),
    );
  }

  setResolution(v: THREE.Vector2) {}

  setVisible(visible: boolean) {
    this.group.visible = visible;
    if (this.outlinePass) {
      this.outlinePass.enabled = this.outlineGlobalEnabled && visible;
    }
  }

  setColor(color: number) {
    // Re-apply materials on hull meshes
    this.baseColor = color;
    // If no texture is set, recolor the hull materials; otherwise only update outline
    if (!this.currentTexture) {
      applyRocketMaterials(this.hull, color, this.useBasicMaterials);
    }
    if (this.outlinePass) {
      try {
        this.outlinePass.visibleEdgeColor.set(color);
        this.outlinePass.hiddenEdgeColor.set(color);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Applies a texture to all rocket meshes except windows. Body meshes render the
   * texture at full brightness; non-body meshes render the same texture darkened
   * to preserve part contrast. While a texture is active, the outline pass uses
   * the provided accentColor if specified; when clearing the texture, the
   * outline reverts to the baseColor.
   *
   * texture: THREE.Texture to apply, or null to clear the texture from all parts.
   * accentColor: Optional 24-bit integer color used for the outline while textured.
   */
  setBodyTexture(texture: THREE.Texture | null, accentColor?: number) {
    // Clear maps when null and update current texture reference
    this.currentTexture = texture;

    // Ensure we have consistent UVs across the hull parts
    this.ensureCylindricalUVsApplied();

    // Configure texture sampling once
    if (texture) {
      const skinId = texture.name;
      const skin = skinId ? getSkinById(skinId) : undefined;
      const halfWrap = skin?.wrap === 'half';
      // const rot90 = Boolean(skin?.rotate90);

      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;

      texture.center.set(0.5, 0.5);
      // texture.rotation = rot90 ? -Math.PI / 2 : 0;

      texture.repeat.set(halfWrap ? 2 : 1, 1);
      texture.offset.x = halfWrap ? 0.5 : 0.25;
      texture.needsUpdate = true;
    }

    this.hull.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const name = child.name || '';
      // Skip windows entirely
      if (name.includes('Window')) return;

      const mat = child.material as
        | THREE.MeshStandardMaterial
        | THREE.MeshBasicMaterial;
      if (texture) {
        // Apply texture to all parts; darker multiplier for non-body parts
        mat.map = texture;
        if (name.includes('Body')) {
          mat.color.set(0xffffff);
        } else {
          // Darken non-body parts to distinguish paneling/fins
          mat.color.setScalar(0.6);
        }
      } else {
        // Clear texture maps; colors restored below via applyRocketMaterials
        mat.map = null;
      }
      mat.needsUpdate = true;
    });

    // Keep outline color aligned with accent while textured; revert when cleared
    if (this.outlinePass) {
      try {
        if (texture && typeof accentColor === 'number') {
          this.outlinePass.visibleEdgeColor.set(accentColor);
          this.outlinePass.hiddenEdgeColor.set(accentColor);
        } else if (!texture) {
          this.outlinePass.visibleEdgeColor.set(this.baseColor);
          this.outlinePass.hiddenEdgeColor.set(this.baseColor);
        }
      } catch {}
    }

    // When clearing the texture, restore original materials/colors
    if (!texture) {
      applyRocketMaterials(this.hull, this.baseColor, this.useBasicMaterials);
    }

    // Do not dispose textures here; textures may be shared via a global cache.
  }

  getOrbitCenter(): THREE.Vector3 {
    this.group.updateWorldMatrix(true, false);
    return this.group.localToWorld(this.centerOffset.clone());
  }

  update(
    position: THREE.Vector3,
    aimPos: THREE.Vector3,
    traveling: boolean,
    animAlpha: number,
  ) {
    this.group.position.copy(position);
    const dir = aimPos.clone().sub(this.group.position);
    if (dir.lengthSq() > 1e-12) {
      dir.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(
        DEFAULT_ROCKET_FORWARD,
        dir,
      );

      this.group.quaternion.copy(q);
      this.spinAngle = traveling
        ? this.spinAngle + ROCKET_SPIN_SPEED
        : this.spinAngle * 0.95;

      this.group.rotateOnAxis(DEFAULT_ROCKET_FORWARD, this.spinAngle);
    }

    // Emit only while movement animation is active (after camera move+hold)
    this.updateExhaust(traveling && animAlpha > 0 && animAlpha < 0.5);
  }

  /**
   * Ensures the rocket maintains at least a minimum apparent size on screen by
   * uniformly scaling the root group based on camera distance and FOV.
   * @param camera Perspective camera used for rendering.
   * @param viewportHeightPx Height of the drawing buffer in pixels.
   */
  enforceMinimumApparentSize(
    camera: THREE.PerspectiveCamera,
    viewportHeightPx: number,
  ): void {
    const minPx = Math.max(0, ROCKET_MIN_SCREEN_PIXELS);
    if (minPx <= 0 || this.baseBoundingRadius <= 1e-9) {
      return;
    }

    // Compute distance from camera to rocket center used for orbiting
    const center = this.getOrbitCenter();
    const distance = camera.position.distanceTo(center);
    if (!(distance > 1e-6)) {
      return;
    }

    // Convert world-space size to pixel size using vertical FOV
    const vFovRad = (camera.fov * Math.PI) / 180;
    const heightWorld = 2 * distance * Math.tan(vFovRad / 2);
    const heightPx = Math.max(1, viewportHeightPx);

    // Pixel radius when group scale is 1
    const pxRadiusAtScale1 = (this.baseBoundingRadius / heightWorld) * heightPx;
    const neededPxRadius = minPx / 2; // interpret constant as minimum diameter

    // Desired uniform scale relative to group scale = 1
    const scaleNeeded =
      pxRadiusAtScale1 > 1e-9 ? neededPxRadius / pxRadiusAtScale1 : 1;

    const targetScale = Math.max(1, scaleNeeded);

    // Apply only if different to avoid needless matrix updates
    if (Math.abs(this.group.scale.x - targetScale) > 1e-4) {
      this.group.scale.setScalar(targetScale);
    }
  }

  private updateExhaust(emit: boolean) {
    type ExhaustUserData = {
      vel: THREE.Vector3;
      age: number;
      life: number;
    };
    // spawn
    if (emit) {
      const toSpawn = 2; // toned down spawn rate
      for (
        let i = 0;
        i < toSpawn && this.sprites.length + this.pool.length < this.maxSprites;
        i++
      ) {
        const sprite = this.obtainSprite();
        // spawn just behind the hull, in local space
        const baseBack = DEFAULT_ROCKET_FORWARD.clone().multiplyScalar(-0.0001); // closer to hull
        sprite.position.copy(baseBack);
        // local velocity mostly backward with small jitter
        const jitter = new THREE.Vector3(
          (Math.random() - 0.5) * 0.005 * ROCKET_EXHAUST_SCALE,
          (-0.01 - Math.random() * 0.01) * ROCKET_EXHAUST_SCALE,
          (Math.random() - 0.5) * 0.005 * ROCKET_EXHAUST_SCALE,
        );

        const ud = sprite.userData as ExhaustUserData;
        ud.vel = jitter;
        ud.age = 0;
        ud.life = 16 + Math.floor(Math.random() * 8); // shorter lifetime
        this.exhaustGroup.add(sprite);
        this.sprites.push(sprite);
      }
    }

    // integrate / fade
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const s = this.sprites[i]!;
      const ud = s.userData as ExhaustUserData;
      ud.age++;
      const life = ud.life;
      const t = ud.age / life;
      const mat = s.material as THREE.SpriteMaterial;
      mat.opacity = 0.6 * (1 - t); // overall dimmer
      s.position.add(ud.vel);
      s.scale.multiplyScalar(0.99);
      if (ud.age >= life) {
        this.exhaustGroup.remove(s);
        mat.dispose();
        this.sprites.splice(i, 1);
        // recycle geometry-less sprite by creating a fresh material when reused
        s.material = new THREE.SpriteMaterial({
          color: 0xff8c00,
          depthWrite: false,
          transparent: true,
          blending: THREE.AdditiveBlending,
        });

        this.pool.push(s);
      }
    }
  }

  private obtainSprite(): THREE.Sprite {
    const s =
      this.pool.pop() ??
      new THREE.Sprite(
        new THREE.SpriteMaterial({
          color: 0xff8c00,
          depthWrite: false,
          transparent: true,
          blending: THREE.AdditiveBlending,
        }),
      );

    s.scale.setScalar(0.01 * ROCKET_EXHAUST_SCALE); // scalable initial size
    return s;
  }

  dispose(): void {
    // dispose sprites/materials
    for (const s of this.sprites) {
      this.exhaustGroup.remove(s);
      (s.material as THREE.SpriteMaterial).dispose();
    }

    for (const s of this.pool) {
      (s.material as THREE.SpriteMaterial).dispose();
    }

    this.sprites = [];
    this.pool = [];
    if (this.outlinePass) {
      try {
        this.outlinePass.dispose();
      } catch {
        // ignore
      }

      this.outlinePass.enabled = false;
      this.outlinePass = undefined;
    }

    if (this.unsubOutlines) {
      try {
        this.unsubOutlines();
      } catch {}

      this.unsubOutlines = undefined;
    }
  }

  static computeAimPosition(
    startCenter: THREE.Vector3,
    targetCenter: THREE.Vector3,
    targetVisualRadius: number,
  ): THREE.Vector3 {
    const dir = targetCenter.clone().sub(startCenter);
    const dirN = dir.clone().normalize();
    return targetCenter
      .clone()
      .sub(
        dirN
          .clone()
          .multiplyScalar(targetVisualRadius + ROCKET_LANDING_CLEARANCE),
      );
  }

  static computeSurfaceEndpoints(
    startCenter: THREE.Vector3,
    startVisualRadius: number,
    targetCenter: THREE.Vector3,
    targetVisualRadius: number,
  ): { startSurface: THREE.Vector3; targetSurface: THREE.Vector3 } {
    const dir = targetCenter.clone().sub(startCenter);
    const dirLen = Math.max(1e-9, dir.length());
    const dirN = dir.clone().divideScalar(dirLen);

    const startSurface = startCenter
      .clone()
      .add(dirN.clone().multiplyScalar(startVisualRadius));

    const targetSurface = targetCenter
      .clone()
      .sub(
        dirN
          .clone()
          .multiplyScalar(targetVisualRadius + ROCKET_LANDING_CLEARANCE),
      );

    return { startSurface, targetSurface };
  }

  // ==========================
  // Static model cache / cloning
  // ==========================
  private static baseModelPromise?: Promise<THREE.Group>;
  private static baseModel?: THREE.Group;

  /**
   * Preloads and parses the Rocket OBJ model once, caching the base THREE.Group.
   * Subsequent `create()` calls will clone this cached group instead of reparsing.
   */
  static async preloadModel(): Promise<void> {
    if (Rocket.baseModel) return;
    if (!Rocket.baseModelPromise) {
      Rocket.baseModelPromise = (async () => {
        const rocketAsset = Asset.fromModule(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('../../../assets/Rocket.obj'),
        );
        try {
          await rocketAsset.downloadAsync();
        } catch (err) {
          console.warn(
            '[rocket] downloadAsync failed for Rocket.obj, using uri fallback',
            err,
          );
        }
        const loader = new OBJLoader();
        const uri = rocketAsset.localUri ?? rocketAsset.uri;
        const group: THREE.Group = await new Promise((resolve, reject) => {
          loader.load(uri, resolve, undefined, reject);
        });
        return group;
      })();
    }

    try {
      Rocket.baseModel = await Rocket.baseModelPromise;
    } catch (e) {
      // On failure, clear promise so future attempts can retry
      Rocket.baseModelPromise = undefined;
      throw e;
    }
  }

  /**
   * Returns a deep clone of the cached base model. Materials are intentionally
   * left as-is so instance creation can re-apply desired materials/colors.
   */
  private static cloneBaseModel(): THREE.Group {
    if (!Rocket.baseModel) {
      throw new Error(
        'Rocket base model not loaded. Call preloadModel() first.',
      );
    }
    // Deep clone hierarchy; geometry references are shared which is desired.
    // Materials will be replaced per-instance by applyRocketMaterials()/setBodyTexture().
    const cloned = Rocket.baseModel.clone(true);
    return cloned;
  }
}
