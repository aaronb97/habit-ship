import * as THREE from 'three';
import { TextureLoader } from 'expo-three';
import { Asset } from 'expo-asset';
import { SKY_SEGMENTS, SKY_SPHERE_RADIUS, SKY_BRIGHTNESS } from './constants';

/**
 * Creates a sky sphere mesh immediately and loads its starfield texture
 * asynchronously in the background. This avoids blocking the first render.
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

  return skyMesh;
}
