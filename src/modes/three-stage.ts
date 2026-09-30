import type * as Three from 'three';
import { BACKGROUND, createCanvas, sceneCtx } from '../canvas';
import { colorHsl } from '../color';
import { showWarning } from '../dom';
import { approach, decay, hueDelta, lerp, randomRange, signedRandom, TAU } from '../math';
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

export function createRenderer(THREE: ThreeModule, background = BACKGROUND) {
  const renderer = new THREE.WebGLRenderer({ canvas: createCanvas(), antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setClearColor(new THREE.Color().setStyle(background, THREE.LinearSRGBColorSpace));
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

export const STREAM = `
  uniform vec3 uOffset;
  uniform float uCube;
  uniform float uFieldRadius;
  vec3 streamed(vec3 p) {
    return mod(p - uOffset, uCube) - uCube * 0.5;
  }
`;

export const STREAK_VERTEX = `
  ${STREAM}
  uniform float uStreak;
  uniform vec3 uHeading;
  attribute float aSeed;
  attribute float aTail;
  varying float vFade;
  varying float vSeed;
  void main() {
    vec3 p = streamed(position);
    p += uHeading * aTail * uStreak * (0.5 + aSeed);
    vec4 eye = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * eye;
    float distance = length(eye.xyz);
    vFade = (1.0 - aTail) * (1.0 - smoothstep(uFieldRadius * 0.5, uFieldRadius, distance)) * smoothstep(0.5, 3.0, distance);
    vSeed = aSeed;
  }
`;

export const STREAK_FRAGMENT = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uStreakAlpha;
  varying float vFade;
  varying float vSeed;
  void main() {
    vec3 tint = mix(vec3(0.8), mix(uColorA, uColorB, fract(vSeed * 7.31)), 0.7);
    gl_FragColor = vec4(tint * vFade * uStreakAlpha, 1.0);
  }
`;

export const BILLBOARD_VERTEX = `
  uniform float uRadius;
  varying vec2 vUv;
  void main() {
    vec4 eye = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    eye.xy += position.xy * uRadius;
    gl_Position = projectionMatrix * eye;
    vUv = uv;
  }
`;

export const SUN_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uSpin;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv * 2.0 - 1.0;
    float d = length(c);
    if (d > 1.0) discard;
    float a = atan(c.y, c.x);
    float core = (1.0 - smoothstep(0.15, 0.2, d));
    float glow = exp(-d * 6.0) * 1.3 + exp(-d * 16.0);
    float rays = pow(abs(sin(a * 5.0 + uTime * 0.6 + uSpin)), 24.0) * exp(-d * 3.5) * 0.7
      + pow(abs(sin(a * 9.0 - uTime * 0.35)), 36.0) * exp(-d * 2.6) * 0.45;
    float light = (core + glow + rays) * (1.0 - smoothstep(0.6, 1.0, d));
    gl_FragColor = vec4(mix(uColor, vec3(1.0), clamp(core + exp(-d * 12.0), 0.0, 1.0)) * light * uIntensity, 1.0);
  }
`;

export function createStarGeometry(THREE: ThreeModule, count: number, cube: number) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions.set([randomRange(0, cube), randomRange(0, cube), randomRange(0, cube)], i * 3);
    seeds[i] = Math.random();
  }
  const stars = new THREE.BufferGeometry();
  stars.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  stars.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const streakPositions = new Float32Array(count * 6);
  const streakSeeds = new Float32Array(count * 2);
  const tails = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const star = positions.subarray(i * 3, i * 3 + 3);
    streakPositions.set(star, i * 6);
    streakPositions.set(star, i * 6 + 3);
    streakSeeds[i * 2] = streakSeeds[i * 2 + 1] = seeds[i];
    tails[i * 2 + 1] = 1;
  }
  const streaks = new THREE.BufferGeometry();
  streaks.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
  streaks.setAttribute('aSeed', new THREE.BufferAttribute(streakSeeds, 1));
  streaks.setAttribute('aTail', new THREE.BufferAttribute(tails, 1));
  return { stars, streaks };
}

export function normalizeGeometry(geometry: Three.BufferGeometry) {
  geometry.computeBoundingSphere();
  const { center, radius } = geometry.boundingSphere!;
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(1 / radius, 1 / radius, 1 / radius);
  geometry.computeBoundingSphere();
  return geometry;
}
