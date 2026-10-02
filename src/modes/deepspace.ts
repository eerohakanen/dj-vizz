import type * as Three from 'three';
import { approach, clamp, clamp01, decay, randomRange, TAU } from '../math';
import { clock, fx, impulse, settings, signal } from '../state';
import {
  additiveOptions,
  advanceSway,
  BILLBOARD_VERTEX,
  cameraJitter,
  createKick,
  createRenderer,
  createStarGeometry,
  fitStage,
  GLOW_POINT_FRAGMENT,
  glowLevel,
  lazyStage,
  paint,
  paintPalette,
  pointScale,
  presentStage,
  STREAK_FRAGMENT,
  STREAK_VERTEX,
  STREAM,
  SUN_FRAGMENT,
  sway,
  type ThreeModule,
} from './three-stage';

const CUBE = 240;
const FIELD_RADIUS = CUBE / 2;
const FAR = 400;
const STAR_COUNT = 9000;
const GALAXY_COUNT = 16000;
const GALAXY_RADIUS = 220;
const GALAXY_ARMS = 3;
const SUN_COUNT = 3;
const NEBULA_COUNT = 10;
const BASE_FOV = 70;
const FOV_GLIDE = 8;

const STAR_VERTEX = `
  ${STREAM}
  uniform float uScale;
  uniform float uSize;
  attribute float aSeed;
  varying float vSeed;
  varying float vFade;
  void main() {
    vec4 eye = modelViewMatrix * vec4(streamed(position), 1.0);
    gl_Position = projectionMatrix * eye;
    float distance = length(eye.xyz);
    float size = uSize * (0.4 + aSeed) * uScale / max(-eye.z, 0.5);
    vFade = (1.0 - smoothstep(uFieldRadius * 0.55, uFieldRadius, distance)) * smoothstep(0.5, 4.0, distance) * min(1.0, size / 1.5);
    vSeed = aSeed;
    gl_PointSize = clamp(size, 1.5, 48.0);
  }
`;

const GALAXY_VERTEX = `
  uniform float uScale;
  uniform float uTime;
  uniform float uKick;
  attribute float aSeed;
  attribute float aRadius;
  varying float vRadius;
  varying float vLight;
  void main() {
    vec4 eye = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * eye;
    float twinkle = 0.75 + 0.25 * sin(uTime * 3.0 + aSeed * 60.0);
    vRadius = aRadius;
    vLight = twinkle * (1.0 - aRadius * 0.6);
    gl_PointSize = clamp((1.2 + aSeed * 2.2 + uKick * 1.5) * uScale / max(-eye.z, 1.0), 1.0, 12.0);
  }
`;

const GALAXY_FRAGMENT = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uGlow;
  varying float vRadius;
  varying float vLight;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    vec3 core = vec3(1.0, 0.92, 0.8);
    vec3 tint = mix(core, mix(uColorA, uColorB, smoothstep(0.3, 1.0, vRadius)), smoothstep(0.0, 0.35, vRadius));
    gl_FragColor = vec4(tint * exp(-d * d * 5.0) * vLight * uGlow * 0.55, 1.0);
  }
`;

const NEBULA_FRAGMENT = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uTime;
  uniform float uSeed;
  uniform float uIntensity;
  varying vec2 vUv;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    vec2 c = vUv * 2.0 - 1.0;
    float d = length(c);
    if (d > 1.0) discard;
    float n = noise(c * 2.5 + uSeed + uTime * 0.04) * 0.65 + noise(c * 6.0 - uSeed - uTime * 0.07) * 0.35;
    float mask = (1.0 - smoothstep(0.15, 1.0, d)) * smoothstep(0.3, 0.85, n);
    gl_FragColor = vec4(mix(uColorA, uColorB, n) * mask * uIntensity, 1.0);
  }
`;

type DeepSpaceStage = ReturnType<typeof buildStage>;

interface Billboard {
  mesh: Three.Object3D;
  hue?: number;
}

const kick = createKick();
let speed = 8;
let yaw = 0;
let pitch = 0;
let yawRate = 0;
let pitchRate = 0;
let turnYaw = 0;
let turnPitch = 0;
let bank = 0;
let roll = 0;
let rollVelocity = 0;
let dropping = false;

function createGalaxyGeometry(THREE: ThreeModule) {
  const positions = new Float32Array(GALAXY_COUNT * 3);
  const seeds = new Float32Array(GALAXY_COUNT);
  const radii = new Float32Array(GALAXY_COUNT);
  for (let i = 0; i < GALAXY_COUNT; i++) {
    const radius = Math.pow(Math.random(), 1.6);
    const scatter = (1 - radius * 0.7) * 0.35;
    const angle = ((i % GALAXY_ARMS) / GALAXY_ARMS) * TAU + radius * 5.5 + randomRange(-scatter, scatter);
    const distance = radius * GALAXY_RADIUS;
    positions.set(
      [
        Math.cos(angle) * distance + randomRange(-6, 6),
        randomRange(-1, 1) * (1 - radius) * 14,
        Math.sin(angle) * distance + randomRange(-6, 6),
      ],
      i * 3,
    );
    seeds[i] = Math.random();
    radii[i] = radius;
  }
  const galaxy = new THREE.BufferGeometry();
  galaxy.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  galaxy.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  galaxy.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
  return galaxy;
}

function spawnBillboard(stage: DeepSpaceStage, body: Billboard, near: number, far: number, minOffset: number, maxOffset: number) {
  const { heading, right, up } = stage;
  const angle = Math.random() * TAU;
  const offset = randomRange(minOffset, maxOffset);
  body.mesh.position
    .copy(heading)
    .multiplyScalar(randomRange(near, far))
    .addScaledVector(right, Math.cos(angle) * offset)
    .addScaledVector(up, Math.sin(angle) * offset);
  body.hue = Math.random() * 2;
}

function buildStage(THREE: ThreeModule) {
  const renderer = createRenderer(THREE);

  const shared = {
    uTime: { value: 0 },
    uOffset: { value: new THREE.Vector3() },
    uCube: { value: CUBE },
    uFieldRadius: { value: FIELD_RADIUS },
    uScale: { value: 1 },
    uKick: { value: 0 },
    uColorA: { value: new THREE.Color() },
    uColorB: { value: new THREE.Color() },
    uGlow: { value: 1 },
  };
  const additive = (vertexShader: string, fragmentShader: string, uniforms: Record<string, Three.IUniform> = {}) =>
    new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { ...shared, ...uniforms },
      ...additiveOptions(THREE),
      depthTest: false,
    });

  const scene = new THREE.Scene();
  const { stars, streaks } = createStarGeometry(THREE, STAR_COUNT, CUBE);
  const starMaterial = additive(STAR_VERTEX, GLOW_POINT_FRAGMENT, { uSize: { value: 0.5 } });
  const streakMaterial = additive(STREAK_VERTEX, STREAK_FRAGMENT, {
    uStreak: { value: 0 },
    uStreakAlpha: { value: 0 },
    uHeading: { value: new THREE.Vector3(0, 0, -1) },
  });
  const galaxyMaterial = additive(GALAXY_VERTEX, GALAXY_FRAGMENT);

  const galaxyTilt = new THREE.Group();
  galaxyTilt.position.set(0, -30, -FAR * 1.3);
  galaxyTilt.rotation.set(0.42 * Math.PI, 0, 0.2);
  const galaxy = new THREE.Points(createGalaxyGeometry(THREE), galaxyMaterial);
  galaxyTilt.add(galaxy);

  const quad = new THREE.PlaneGeometry(2, 2);
  const createSun = (radius: number) => {
    const material = additive(BILLBOARD_VERTEX, SUN_FRAGMENT, {
      uRadius: { value: radius },
      uColor: { value: new THREE.Color() },
      uSpin: { value: Math.random() * TAU },
      uIntensity: { value: 0 },
    });
    return { mesh: new THREE.Mesh(quad, material), material, hue: 0, radius };
  };
  const core = createSun(70);
  galaxyTilt.add(core.mesh);
  const suns = Array.from({ length: SUN_COUNT }, () => createSun(randomRange(5, 10)));
  const nebulae = Array.from({ length: NEBULA_COUNT }, () => {
    const material = additive(BILLBOARD_VERTEX, NEBULA_FRAGMENT, {
      uRadius: { value: randomRange(35, 80) },
      uSeed: { value: Math.random() * 100 },
      uIntensity: { value: 0 },
    });
    return { mesh: new THREE.Mesh(quad, material), material };
  });

  for (const object of [galaxyTilt, ...nebulae.map((n) => n.mesh), new THREE.Points(stars, starMaterial), new THREE.LineSegments(streaks, streakMaterial), ...suns.map((s) => s.mesh)]) {
    object.frustumCulled = false;
    scene.add(object);
  }
  core.mesh.frustumCulled = false;

  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, FAR * 3);
  camera.rotation.order = 'YXZ';
  return {
    THREE,
    renderer,
    scene,
    camera,
    shared,
    starMaterial,
    streakMaterial,
    galaxy,
    core,
    suns,
    nebulae,
    heading: new THREE.Vector3(0, 0, -1),
    right: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 1, 0),
    width: 0,
    height: 0,
  };
}

function createStage(THREE: ThreeModule) {
  const created = buildStage(THREE);
  const { suns, nebulae } = created;
  suns.forEach((sun, i) => spawnBillboard(created, sun, (FAR * i) / SUN_COUNT, (FAR * (i + 1)) / SUN_COUNT, 10, 32));
  nebulae.forEach((nebula, i) => spawnBillboard(created, nebula, (FAR * i) / NEBULA_COUNT, (FAR * (i + 1)) / NEBULA_COUNT, 30, 90));
  return created;
}

const deepSpace = lazyStage(() => import('three').then(createStage));

const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

function throwTurn(strength: number) {
  const reach = strength * (0.4 + signal.energy * 1.2);
  turnYaw = randomRange(-1, 1) * reach;
  turnPitch = randomRange(-1, 1) * reach * 0.5;
}

function steer(stage: DeepSpaceStage) {
  const { delta, time } = clock;
  const { gate, energy, punchBass } = signal;
  if (fx.drop > 0.9 && !dropping) {
    dropping = true;
    throwTurn(1.8);
    rollVelocity = (Math.random() < 0.5 ? -1 : 1) * 6;
  } else if (fx.drop < 0.5) dropping = false;
  const wander = (Math.sin(time * 0.21) * 0.25 + Math.sin(time * 0.07 + 1) * 0.35) * (0.3 + energy);
  const push = 1 + punchBass * gate * 0.8;
  yawRate = approach(yawRate, (turnYaw + wander * gate) * push - wrapAngle(yaw) * 0.12, 2.5, delta);
  pitchRate = approach(pitchRate, (turnPitch + Math.sin(time * 0.17) * 0.12 * gate) * push - pitch * 0.6, 2.5, delta);
  turnYaw *= decay(0.25, delta);
  turnPitch *= decay(0.25, delta);
  yaw += yawRate * delta;
  pitch = clamp(pitch + pitchRate * delta, -1.1, 1.1);
  bank = approach(bank, yawRate * 0.7, 3, delta);
  rollVelocity *= decay(0.25, delta);
  roll += rollVelocity * delta;
  const { heading, right, up } = stage;
  heading.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  right.set(Math.cos(yaw), 0, -Math.sin(yaw));
  up.crossVectors(right, heading);
}

function fly(stage: DeepSpaceStage) {
  const { gate, energy, punchBass } = signal;
  const target = (8 + gate * (energy * 40 + punchBass * 90 + kick.value * 40) + fx.drop * 650) * settings.motion;
  speed = approach(speed, target, target > speed ? 8 : 2.5, clock.delta);
  const offset = stage.shared.uOffset.value.addScaledVector(stage.heading, speed * clock.delta);
  offset.set(offset.x % CUBE, offset.y % CUBE, offset.z % CUBE);
}

function updateUniforms(stage: DeepSpaceStage) {
  const { shared, starMaterial, streakMaterial, camera } = stage;
  shared.uTime.value = clock.time;
  shared.uKick.value = kick.value;
  shared.uScale.value = pointScale(camera);
  shared.uGlow.value = glowLevel(kick.value);
  paintPalette(stage, shared.uColorA.value, shared.uColorB.value);
  starMaterial.uniforms.uSize.value = 0.45 + kick.value * 0.35 + signal.punchHigh * 0.3;
  streakMaterial.uniforms.uStreak.value = speed * 0.12;
  streakMaterial.uniforms.uHeading.value.copy(stage.heading);
  streakMaterial.uniforms.uStreakAlpha.value = clamp01((speed - 20) / 120);
}

function drift(stage: DeepSpaceStage, body: Billboard, behind: number, minOffset: number, maxOffset: number) {
  const { position } = body.mesh;
  position.addScaledVector(stage.heading, -speed * clock.delta);
  const ahead = position.dot(stage.heading);
  if (ahead < -behind || position.length() > FAR * 1.1) spawnBillboard(stage, body, FAR * 0.85, FAR, minOffset, maxOffset);
  return { ahead: position.dot(stage.heading), distance: position.length() };
}

function advanceBodies(stage: DeepSpaceStage) {
  for (const sun of stage.suns) {
    const { ahead, distance } = drift(stage, sun, 2, 10, 32);
    const { uniforms } = sun.material;
    paint(stage, uniforms.uColor.value, sun.hue);
    uniforms.uIntensity.value = (0.9 + signal.punchBass * 0.8 + kick.value * 0.5) * Math.min(1, (FAR - distance) / 80) * clamp01(ahead / 6);
  }
  for (const nebula of stage.nebulae) {
    const { ahead, distance } = drift(stage, nebula, 10, 30, 90);
    nebula.material.uniforms.uIntensity.value = (0.18 + signal.mid * 0.25 + fx.drop * 0.3) * Math.min(1, (FAR - distance) / 120) * clamp01(ahead / 40);
  }
  const { core, galaxy } = stage;
  paint(stage, core.material.uniforms.uColor.value, 0.5, 70);
  core.material.uniforms.uIntensity.value = 0.55 + signal.mid * 0.5 + kick.value * 0.4 + fx.drop * 1.5;
  galaxy.rotation.y = -fx.spin * 0.25 - clock.time * 0.02;
}

function moveCamera(stage: DeepSpaceStage) {
  const { camera } = stage;
  const jitter = cameraJitter(0.6);
  advanceSway();
  camera.position.set(sway(0.31, 2) * 4 + jitter(), sway(0.23, 1, Math.PI / 2) * 3 + jitter(), 0);
  camera.rotation.set(
    pitch + sway(0.17, 2) * 0.05,
    yaw + sway(0.13, 2, 1) * 0.06,
    bank + roll + fx.spin * 0.15 + sway(0.09, 1) * 0.2,
  );
  camera.fov = approach(camera.fov, BASE_FOV + kick.value * 6 + Math.min(40, fx.drop * 35 + Math.max(0, speed - 60) * 0.04), FOV_GLIDE, clock.delta);
  camera.updateProjectionMatrix();
}

export function pulseDeepSpace() {
  kick.pulse();
  if (impulse.beat > 0.5 && Math.random() < 0.35 + signal.energy * 0.4) throwTurn(impulse.beat);
}

export function drawDeepSpace() {
  const stage = deepSpace.get();
  if (!stage) return;
  kick.decay();
  fitStage(stage);
  steer(stage);
  fly(stage);
  moveCamera(stage);
  updateUniforms(stage);
  advanceBodies(stage);
  presentStage(stage);
}
