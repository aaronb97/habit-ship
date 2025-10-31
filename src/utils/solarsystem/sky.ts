import * as THREE from 'three';
import { TextureLoader } from 'expo-three';
import { Asset } from 'expo-asset';
import { SKY_SEGMENTS, SKY_SPHERE_RADIUS, SKY_BRIGHTNESS } from './constants';

/**
 * Creates a sky sphere mesh and begins loading its starfield texture asynchronously.
 * The mesh starts transparent (opacity 0) and fades in to opaque to avoid a pop.
 *
 * Returns: THREE.Mesh sky sphere with a basic material; its texture map will
 * be populated once the underlying image finishes loading.
 */
export function createSky(): THREE.Mesh {
  const skyGeometry = new THREE.SphereGeometry(SKY_SPHERE_RADIUS, SKY_SEGMENTS, SKY_SEGMENTS);

  const skyMaterial = new THREE.MeshBasicMaterial({
    // Start black until texture loads; brightness applied once map is set
    color: new THREE.Color(0x000000),
    side: THREE.BackSide,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  });

  const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);

  // Kick off async texture load and apply when ready
  void (async () => {
    const spaceAsset = Asset.fromModule(require('../../../assets/cbodies/space.jpg'));

    try {
      await spaceAsset.downloadAsync();
    } catch (err) {
      console.warn('[sky] downloadAsync failed for space.jpg, using uri fallback', err);
    }

    const loader = new TextureLoader();
    const src = spaceAsset.localUri ?? spaceAsset.uri;
    try {
      const tex = await loader.loadAsync(src);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = skyMesh.material as THREE.MeshBasicMaterial;
      mat.map = tex;
      mat.color.setScalar(SKY_BRIGHTNESS);
      mat.needsUpdate = true;
    } catch (e) {
      console.warn('[sky] Failed to load space texture', e);
    }
  })();

  // Start fade-in to opaque
  const mat = skyMesh.material as THREE.MeshBasicMaterial;
  const fadeIn = () => {
    if (mat.opacity < 1) {
      mat.opacity = Math.min(1, mat.opacity + 0.02);
      requestAnimationFrame(fadeIn);
    } else {
      mat.transparent = false;
    }
  };
  fadeIn();

  return skyMesh;
}
