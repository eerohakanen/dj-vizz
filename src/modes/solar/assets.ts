import type * as Three from 'three';
import { showWarning } from '../../dom';
import { normalizeGeometry } from '../three-stage';

const TEXTURE_PATH = `${import.meta.env.BASE_URL}solar/`;
const ASTEROID_URL = `${import.meta.env.BASE_URL}models/bennu.glb`;

export const loadModules = () => Promise.all([import('three'), import('three/examples/jsm/loaders/GLTFLoader.js')]);

export type Modules = Awaited<ReturnType<typeof loadModules>>;

let warned = false;

function warnOnce() {
  if (warned) return;
  warned = true;
  showWarning('Solar System assets failed to load');
}

export function createTextureLoader([THREE]: Modules) {
  const loader = new THREE.TextureLoader();
  return (file: string, apply: (texture: Three.Texture) => void, colorSpace: string = THREE.SRGBColorSpace) =>
    loader.load(
      TEXTURE_PATH + file,
      (texture) => {
        texture.colorSpace = colorSpace;
        apply(texture);
      },
      undefined,
      warnOnce,
    );
}

export function loadAsteroid([THREE, { GLTFLoader }]: Modules, apply: (geometry: Three.BufferGeometry) => void) {
  new GLTFLoader()
    .loadAsync(ASTEROID_URL)
    .then((gltf) => {
      let geometry: Three.BufferGeometry | undefined;
      gltf.scene.traverse((object) => {
        if (!geometry && object instanceof THREE.Mesh) geometry = object.geometry;
      });
      if (!geometry) return;
      apply(normalizeGeometry(geometry));
    })
    .catch(warnOnce);
}
