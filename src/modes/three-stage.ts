import type * as Three from 'three';
import { BACKGROUND, createCanvas, sceneCtx } from '../canvas';
import { color } from '../color';
import { view } from '../state';

export type ThreeModule = typeof Three;

export interface Stage {
  THREE: ThreeModule;
  renderer: Three.WebGLRenderer;
  scene: Three.Scene;
  camera: Three.PerspectiveCamera;
  width: number;
  height: number;
}

export const GLOW_POINT_FRAGMENT = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uGlow;
  varying float vSeed;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float light = exp(-d * d * 10.0) + exp(-d * 4.0) * 0.3 * uGlow;
    vec3 tint = mix(vec3(1.0), mix(uColorA, uColorB, fract(vSeed * 7.31)), 0.6);
    gl_FragColor = vec4(tint * light * vFade, 1.0);
  }
`;

export function createRenderer(THREE: ThreeModule) {
  const renderer = new THREE.WebGLRenderer({ canvas: createCanvas(), antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setClearColor(new THREE.Color().setStyle(BACKGROUND, THREE.LinearSRGBColorSpace));
  return renderer;
}

export function fitStage(stage: Stage) {
  const { width, height } = view;
  if (stage.width === width && stage.height === height) return;
  stage.width = width;
  stage.height = height;
  stage.renderer.setSize(width, height, false);
  stage.camera.aspect = width / height;
}

export function paint(stage: Stage, target: Three.Color, position: number, lightness?: number) {
  target.setStyle(color(position, 1, lightness), stage.THREE.LinearSRGBColorSpace);
}

export function pointScale(camera: Three.PerspectiveCamera) {
  return view.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
}

export function presentStage(stage: Stage) {
  stage.renderer.render(stage.scene, stage.camera);
  sceneCtx.drawImage(stage.renderer.domElement, 0, 0, view.width, view.height);
}
