import * as THREE from 'three';
import { TextureLoader } from 'expo-three';
import { Asset } from 'expo-asset';
import { TEXTURE_ANISOTROPY } from './constants';

// Map planet/star names to their texture assets in assets/cbodies
// We use require() so Metro bundles the images and Expo Asset can resolve to a local URI.
const BODY_TEXTURE_REQUIRE: Record<string, number> = {
  Sun: require('../../../assets/cbodies/sun.jpg'),
  Earth: require('../../../assets/cbodies/earth.jpg'),
  'The Moon': require('../../../assets/cbodies/moon.jpg'),
  Mercury: require('../../../assets/cbodies/mercury.jpg'),
  Venus: require('../../../assets/cbodies/venus.jpg'),
  Mars: require('../../../assets/cbodies/mars.jpg'),
  Jupiter: require('../../../assets/cbodies/jupiter.jpg'),
  Saturn: require('../../../assets/cbodies/saturn.jpg'),
  Uranus: require('../../../assets/cbodies/uranus.jpg'),
  Neptune: require('../../../assets/cbodies/neptune.jpg'),
  Pluto: require('../../../assets/cbodies/pluto.jpg'),
  Io: require('../../../assets/cbodies/io.jpg'),
  Europa: require('../../../assets/cbodies/europa.jpg'),
  Ganymede: require('../../../assets/cbodies/ganymede.jpg'),
  Callisto: require('../../../assets/cbodies/callisto.jpg'),
  Titan: require('../../../assets/cbodies/titan.jpg'),
  Iapetus: require('../../../assets/cbodies/iapetus.jpg'),
  Triton: require('../../../assets/cbodies/triton.png'),
};

// Optional auxiliary textures keyed by body name (e.g., rings)
const RING_TEXTURE_REQUIRE: Record<string, number> = {
  Saturn: require('../../../assets/cbodies/saturn_rings.png'),
};

export async function loadBodyTextures(
  names: string[],
): Promise<Record<string, THREE.Texture>> {
  const textures: Record<string, THREE.Texture> = {};
  const loader = new TextureLoader();

  for (const name of names) {
    const req = BODY_TEXTURE_REQUIRE[name];
    if (!req) {
      continue;
    }

    try {
      const asset = Asset.fromModule(req);
      try {
        await asset.downloadAsync();
      } catch (err) {
        console.warn(`[textures] downloadAsync failed for ${name}, using uri fallback`, err);
      }
      const src = asset.localUri ?? asset.uri;
      const tex = await loader.loadAsync(src);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = TEXTURE_ANISOTROPY;
      textures[name] = tex;
    } catch (e) {
      console.warn(`[textures] Failed to load texture for ${name}`, e);
    }
  }

  return textures;
}

export async function loadRingTextures(
  names: string[],
): Promise<Record<string, THREE.Texture>> {
  const textures: Record<string, THREE.Texture> = {};
  const loader = new TextureLoader();

  for (const name of names) {
    const req = RING_TEXTURE_REQUIRE[name];
    if (!req) continue;
    try {
      const asset = Asset.fromModule(req);
      try {
        await asset.downloadAsync();
      } catch (err) {
        console.warn(`[textures] downloadAsync failed for ring ${name}, using uri fallback`, err);
      }
      const src = asset.localUri ?? asset.uri;
      const tex = await loader.loadAsync(src);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = TEXTURE_ANISOTROPY;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      textures[name] = tex;
    } catch (e) {
      console.warn(`[textures] Failed to load ring texture for ${name}`, e);
    }
  }

  return textures;
}
