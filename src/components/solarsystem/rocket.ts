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
} from './constants';

// Apply per-part materials/colors to the loaded rocket model
function applyRocketMaterials(obj: THREE.Group, baseColor: number) {
  const base = new THREE.Color(baseColor);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  // Darker variant for non-body, non-window parts
  const altL = Math.max(0, Math.min(1, hsl.l - 0.5));

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
        const mat = new THREE.MeshStandardMaterial();
        mat.color.set(base);
        child.material = mat;
      } else {
        const mat = new THREE.MeshStandardMaterial();
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
};

export class Rocket {
  public readonly group: THREE.Group;
  private readonly hull: THREE.Group;
  private readonly exhaustGroup: THREE.Group;
  private readonly color: number;
  private outlinePass?: OutlinePass;
  private spinAngle = 0;

  // exhaust sprites
  private sprites: THREE.Sprite[] = [];
  private pool: THREE.Sprite[] = [];
  private readonly maxSprites = 120;

  private constructor(
    color: number,
    group: THREE.Group,
    hull: THREE.Group,
    exhaustGroup: THREE.Group,
    outlinePass?: OutlinePass,
  ) {
    this.color = color;
    this.group = group;
    this.hull = hull;
    this.exhaustGroup = exhaustGroup;
    this.outlinePass = outlinePass;
  }

  static async create({
    color,
    scene,
    camera,
    composer,
    resolution,
  }: CreateArgs): Promise<Rocket> {
    const rocketAsset = Asset.fromModule(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../../assets/Rocket.obj'),
    );

    await rocketAsset.downloadAsync();
    const loader = new OBJLoader();
    const uri = rocketAsset.localUri ?? rocketAsset.uri;
    const obj: THREE.Group = await new Promise((resolve, reject) => {
      loader.load(uri, resolve, undefined, reject);
    });

    obj.rotation.x = THREE.MathUtils.degToRad(-90);

    applyRocketMaterials(obj, color);

    obj.scale.setScalar(ROCKET_MODEL_SCALE);

    const root = new THREE.Group();
    const exhaust = new THREE.Group();
    root.add(obj);
    root.add(exhaust);

    // Outline just the hull (not the exhaust)
    const outline = new OutlinePass(
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
    outline.enabled = true;
    composer.addPass(outline);

    return new Rocket(color, root, obj, exhaust, outline);
  }

  setResolution(v: THREE.Vector2) {
    if (this.outlinePass) this.outlinePass.resolution.copy(v);
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
    if (this.outlinePass) this.outlinePass.enabled = visible;
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
}
