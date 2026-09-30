import type * as Three from 'three';
import { BACKGROUND, createCanvas, sceneCtx } from '../canvas';
import { colorHsl } from '../color';
import { showWarning } from '../dom';
import { approach, decay, hueDelta, lerp, signedRandom, TAU } from '../math';
import { clock, fx, signal, view } from '../state';

export type ThreeModule = typeof Three;

interface Stage {
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

const RETRY_DELAY_MS = 5000;

export function lazyStage<T>(load: () => Promise<T>) {
  let stage: T | undefined;
  let loading = false;
  let warned = false;
  let retryAt = 0;
  return {
    get() {
      if (stage === undefined && !loading && Date.now() >= retryAt) {
        loading = true;
        load()
          .then((loaded) => {
            stage = loaded;
          })
          .catch(() => {
            retryAt = Date.now() + RETRY_DELAY_MS;
            if (warned) return;
            warned = true;
            showWarning('3D mode failed to load');
          })
          .finally(() => {
            loading = false;
          });
      }
      return stage;
    },
  };
}

export function createKick() {
  return {
    value: 0,
    pulse() {
      this.value = Math.max(this.value, fx.beat);
    },
    decay() {
      this.value *= decay(0.03, clock.delta);
    },
  };
}

const RAD_TO_DEG = 180 / Math.PI;
const SWAY_BEATS = 32;
const SWAY_LOCK_RATE = 1.5;
const SWAY_PULL_RATE = 0.5;
const SWAY_LOCKED_AMPLITUDE = 0.4;
const DEFAULT_BEAT_RATE = 2;

let swayLock = 0;
let swayPhase = 0;
let swayBeatRate = DEFAULT_BEAT_RATE;

const swayTarget = () => (TAU * ((signal.phraseBeat % SWAY_BEATS) + signal.beatPhase)) / SWAY_BEATS;

export function advanceSway() {
  const { delta } = clock;
  const locked = signal.bpm > 0;
  swayLock = approach(swayLock, locked ? 1 : 0, SWAY_LOCK_RATE, delta);
  if (locked) swayBeatRate = signal.bpm / 60;
  swayPhase += (TAU * swayBeatRate * delta) / SWAY_BEATS;
  if (locked) swayPhase += hueDelta(swayPhase * RAD_TO_DEG, swayTarget() * RAD_TO_DEG) * (Math.PI / 180) * Math.min(1, delta * SWAY_PULL_RATE);
}

export function sway(frequency: number, harmonic: number, offset = 0) {
  const free = Math.sin(clock.time * frequency);
  if (swayLock < 0.001) return free;
  return lerp(free, Math.sin(swayPhase * harmonic + offset) * SWAY_LOCKED_AMPLITUDE, swayLock);
}

export const glowLevel = (kick: number) => 0.7 + signal.mid * 0.8 + kick * 0.8 + fx.drop;

export const cameraJitter = (scale: number) => () => signedRandom(fx.shake * scale);

export const additiveOptions = (THREE: ThreeModule) => ({
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
});

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
  const hsl = colorHsl(position, lightness);
  target.setHSL(hsl[0] / 360, hsl[1] / 100, hsl[2] / 100, stage.THREE.LinearSRGBColorSpace);
}

export function paintPalette(stage: Stage, colorA: Three.Color, colorB: Three.Color) {
  paint(stage, colorA, 0);
  paint(stage, colorB, 1);
}

export function pointScale(camera: Three.PerspectiveCamera) {
  return view.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
}

export function presentStage(stage: Stage) {
  stage.renderer.render(stage.scene, stage.camera);
  sceneCtx.drawImage(stage.renderer.domElement, 0, 0, view.width, view.height);
}
