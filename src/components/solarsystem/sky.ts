import * as THREE from 'three';
import { TextureLoader } from 'expo-three';
import { Asset } from 'expo-asset';
import { SKY_SEGMENTS, SKY_SPHERE_RADIUS } from './constants';

export async function createSky(): Promise<THREE.Mesh> {
  const spaceAsset = Asset.fromModule(
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('../../../assets/cbodies/space.jpg'),
  );

  await spaceAsset.downloadAsync();

  const loader = new TextureLoader();
  const spaceTexture = await loader.loadAsync(spaceAsset.localUri ?? spaceAsset.uri);

  // Ensure correct color space for sRGB textures
  spaceTexture.colorSpace = THREE.SRGBColorSpace;

  const skyGeometry = new THREE.SphereGeometry(
    SKY_SPHERE_RADIUS,
    SKY_SEGMENTS,
    SKY_SEGMENTS,
  );

  const skyMaterial = new THREE.MeshBasicMaterial({
    map: spaceTexture,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
  return skyMesh;
}
