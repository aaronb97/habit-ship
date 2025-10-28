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
  ROCKET_MATERIAL_MIX_START_SCALE,
  ROCKET_MATERIAL_MIX_FULL_SCALE,
} from './constants';
import { useStore } from '../../utils/store';

// NOTE: Material application is handled by Rocket.setupDualMaterials().

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
  private centerOffset: THREE.Vector3 = new THREE.Vector3();
  private baseBoundingRadius: number = 0;

  private dualPairs: {
    standardMesh: THREE.Mesh;
    basicMesh: THREE.Mesh;
    isBody: boolean;
  }[] = [];

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
  ) {
    this.group = group;
    this.hull = hull;
    this.exhaustGroup = exhaustGroup;
    this.outlinePass = outlinePass;
    this.baseColor = baseColor;
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

    // Initialize materials (dual standard/basic layers) and apply base color
    this.setupDualMaterials();
    this.applyBaseColors();
    this.updateMaterialBlend(0);
  }

  /**
   * Builds dual-material layers for each non-window mesh: a MeshStandardMaterial
   * and a MeshBasicMaterial clone stacked at the same transform, allowing a
   * crossfade between lit and unlit rendering for visibility at distance.
   * Windows remain MeshBasicMaterial only.
   */
  private setupDualMaterials(): void {
    const hours = new Date().getHours();
    const isDaytime = hours >= 8 && hours <= 20;

    const pairs: {
      standardMesh: THREE.Mesh;
      basicMesh: THREE.Mesh;
      isBody: boolean;
    }[] = [];

    this.hull.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const name = child.name || '';

      // Windows: force basic only, no dual layers
      if (name.includes('Window')) {
        const win = new THREE.MeshBasicMaterial();
        win.color.set(isDaytime ? 0xfff8e3 : 0x000000);
        child.material = win;
        return;
      }

      // For all non-window parts, ensure we have a standard layer and add a basic layer clone
      const stdMat = new THREE.MeshStandardMaterial();
      const basicMat = new THREE.MeshBasicMaterial();
      // Transparency and slight polygon offset to avoid z-fighting during crossfade
      stdMat.transparent = true;
      basicMat.transparent = true;
      stdMat.depthWrite = true;
      basicMat.depthWrite = true;
      stdMat.polygonOffset = true;
      basicMat.polygonOffset = true;
      stdMat.polygonOffsetFactor = -1;
      basicMat.polygonOffsetFactor = 1;

      child.material = stdMat;
      const basicMesh = new THREE.Mesh(child.geometry, basicMat);
      basicMesh.position.copy(child.position);
      basicMesh.quaternion.copy(child.quaternion);
      basicMesh.scale.copy(child.scale);
      child.parent?.add(basicMesh);

      pairs.push({
        standardMesh: child,
        basicMesh,
        isBody: name.includes('Body'),
      });
    });

    this.dualPairs = pairs;
  }

  /**
   * Applies the rocket's base color across both material layers for each part.
   * Body parts use the exact base color; other parts use a darker variant for contrast.
   */
  private applyBaseColors(): void {
    const base = new THREE.Color(this.baseColor);
    const hsl = { h: 0, s: 0, l: 0 };
    base.getHSL(hsl);
    const altL = Math.max(0, Math.min(1, hsl.l - 0.2));

    const other = new THREE.Color();
    other.setHSL(hsl.h, hsl.s, altL);

    // Non-window parts: set on both standard/basic materials
    for (const pair of this.dualPairs) {
      const std = pair.standardMesh.material as THREE.MeshStandardMaterial;
      const bas = pair.basicMesh.material as THREE.MeshBasicMaterial;
      const c = pair.isBody ? base : other;
      std.color.copy(c);
      bas.color.copy(c);
      std.map = this.currentTexture ?? null;
      bas.map = this.currentTexture ?? null;
      std.needsUpdate = true;
      bas.needsUpdate = true;
    }
  }

  /**
   * Sets the crossfade between standard (0) and basic (1) materials for all parts.
   * @param t Blend factor in [0,1]; 0 = fully standard, 1 = fully basic.
   */
  private updateMaterialBlend(t: number): void {
    const clamped = Math.max(0, Math.min(1, t));
    for (const pair of this.dualPairs) {
      const std = pair.standardMesh.material as THREE.MeshStandardMaterial;
      const bas = pair.basicMesh.material as THREE.MeshBasicMaterial;
      std.opacity = 1 - clamped;
      bas.opacity = clamped;
      std.visible = std.opacity > 0.001;
      bas.visible = bas.opacity > 0.001;
      // Prefer depth writes from the more opaque layer to maintain occlusion with the scene
      const stdDominant = std.opacity >= bas.opacity;
      std.depthWrite = stdDominant;
      bas.depthWrite = !stdDominant;
    }
  }

  // Removed custom UV generation. The rocket now relies on the model's authored UVs.

  /**
   * Creates a Rocket instance and optionally configures an OutlinePass.
   * @param color 24-bit integer base color for the rocket materials and outline.
   * @param scene THREE.Scene to attach post-processing and meshes to.
   * @param camera Active camera used for OutlinePass configuration.
   * @param composer EffectComposer where the OutlinePass (if any) will be added.
   * @param resolution Current renderer resolution in pixels.
   * @param withoutOutline When true, skips creating an OutlinePass (useful for friend rockets).
   */
  static async create({
    color,
    scene,
    camera,
    composer,
    resolution,
    withoutOutline = false,
  }: CreateArgs): Promise<Rocket> {
    // Ensure base model is preloaded once, then clone it for this instance
    await Rocket.preloadModel();
    const obj = Rocket.cloneBaseModel();
    // Apply default orientation expected by the scene (nose along +Z)
    obj.rotation.x = THREE.MathUtils.degToRad(-90);

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

    return new Rocket(root, obj, exhaust, outline, color);
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
    // If no texture is set, recolor the hull materials on both layers
    if (!this.currentTexture) {
      this.applyBaseColors();
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
   * Applies or clears a texture on all rocket meshes except windows.
   * This method assumes the rocket model has proper UVs and does not modify UVs
   * or texture transforms. Existing material colors are preserved (no special
   * brightening/darkening). While a texture is active, the outline pass uses the
   * provided accentColor if specified; when clearing the texture, the outline
   * reverts to the baseColor.
   *
   * texture: THREE.Texture to apply, or null to clear the texture from all parts.
   * accentColor: Optional 24-bit integer color used for the outline while textured.
   */
  setBodyTexture(texture: THREE.Texture | null, accentColor?: number) {
    // Clear maps when null and update current texture reference
    this.currentTexture = texture;

    // Apply to both layers for all non-window parts
    for (const pair of this.dualPairs) {
      const std = pair.standardMesh.material as THREE.MeshStandardMaterial;
      const bas = pair.basicMesh.material as THREE.MeshBasicMaterial;
      if (texture) {
        std.map = texture;
        bas.map = texture;
        if (pair.isBody) {
          std.color.set(0xffffff);
          bas.color.set(0xffffff);
        } else {
          std.color.setScalar(0.6);
          bas.color.setScalar(0.6);
        }
      } else {
        std.map = null;
        bas.map = null;
      }
      std.needsUpdate = true;
      bas.needsUpdate = true;
    }

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
      this.applyBaseColors();
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

    // Crossfade materials based on enforced scale so distant rockets favor basic
    const startS = Math.max(1, ROCKET_MATERIAL_MIX_START_SCALE);
    const fullS = Math.max(startS + 1e-6, ROCKET_MATERIAL_MIX_FULL_SCALE);
    let t = 0;
    if (targetScale <= startS) t = 0;
    else if (targetScale >= fullS) t = 1;
    else t = (targetScale - startS) / (fullS - startS);
    this.updateMaterialBlend(t);
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
