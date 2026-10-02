import { randomRange, signedRandom } from '../../math';
import { motionScale } from '../../motion';
import { clock, fx, signal } from '../../state';
import { additiveOptions, pointScale, type ThreeModule } from '../three-stage';
import { BELT_CLEARANCE, BODIES, type Body } from './bodies';
import type { SolarStage } from './scene';

const CAPACITY = 3000;
const MAX_POINT_PIXELS = 96;
const COMET_GAP_SECONDS = 7;
const ABSORB = 2;
const TRAIL = 4;
const TAIL = 8;
const STORM_DRIFT = 0.03;

const PARTICLE_VERTEX = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  uniform float uScale;
  varying vec3 vColor;
  void main() {
    vColor = aColor * aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = min(${MAX_POINT_PIXELS}.0, aSize * uScale / -mvPosition.z);
  }
`;

const PARTICLE_FRAGMENT = `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    gl_FragColor = vec4(vColor * (exp(-d * d * 7.0) + exp(-d * 3.0) * 0.2), 1.0);
  }
`;

type V3 = [number, number, number];

interface Spawn {
  at: V3;
  velocity?: V3;
  color: V3;
  life: number;
  size: number;
  drag?: number;
  gravity?: number;
  flags?: number;
  trail?: V3;
}

interface Scene {
  body: Body;
  radius: number;
  toCamera: V3;
  toSun: V3;
  motion: number;
  emit: (spawn: Spawn) => void;
}

interface Event {
  age: number;
  duration: number;
  tick: (scene: Scene, age: number, delta: number) => void;
}

type Phenomenon = (scene: Scene, hits: Hits, delta: number, local: LocalState) => void;

interface Hits {
  kick: boolean;
  snare: boolean;
  hat: boolean;
}

interface LocalState {
  events: Event[];
  storm: V3;
  sinceComet: number;
}

const length3 = ([x, y, z]: V3) => Math.hypot(x, y, z);
const scale3 = ([x, y, z]: V3, factor: number): V3 => [x * factor, y * factor, z * factor];
const add3 = (a: V3, b: V3, factor = 1): V3 => [a[0] + b[0] * factor, a[1] + b[1] * factor, a[2] + b[2] * factor];
const normalize3 = (a: V3) => scale3(a, 1 / (length3(a) || 1));
const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const randomUnit = () => normalize3([signedRandom(2), signedRandom(2), signedRandom(2)]);
const tangentOf = (normal: V3) => normalize3(cross3(normal, Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));

function facing(toCamera: V3, minimum: number) {
  for (let tries = 0; tries < 12; tries++) {
    const candidate = randomUnit();
    if (dot3(candidate, toCamera) > minimum) return candidate;
  }
  return toCamera;
}

function limb(toCamera: V3) {
  const around = normalize3(cross3(toCamera, randomUnit()));
  return normalize3(add3(around, toCamera, 0.25));
}

function burst(scene: Scene, at: V3, color: V3, count: number, speed: number, size: number) {
  for (let i = 0; i < count; i++) {
    scene.emit({ at, velocity: scale3(randomUnit(), speed * randomRange(0.3, 1)), color, life: randomRange(0.4, 1.1), size: size * randomRange(0.5, 1), drag: 2 });
  }
}

const solarFlare: Phenomenon = (scene, hits, _delta, local) => {
  if (!hits.kick) return;
  const { radius } = scene;
  const foot = limb(scene.toCamera);
  const across = tangentOf(foot);
  const lean = randomRange(-0.5, 0.5);
  local.events.push({
    age: 0,
    duration: randomRange(0.5, 0.9),
    tick: (inner, _age, delta) => {
      const count = Math.ceil(delta * 140 * inner.motion);
      for (let i = 0; i < count; i++) {
        const lift = radius * randomRange(1.1, 1.5);
        inner.emit({
          at: add3(scale3(foot, radius * 1.01), across, radius * signedRandom(0.06)),
          velocity: add3(scale3(foot, lift), across, lift * (0.45 + lean)),
          color: [2.2, randomRange(0.7, 1.1), 0.2],
          life: 2.5,
          size: radius * randomRange(0.05, 0.09),
          gravity: radius * 1.8,
          flags: ABSORB,
        });
      }
    },
  });
};

const solarWind: Phenomenon = (scene, hits, delta) => {
  const { radius, toSun } = scene;
  const side = tangentOf(toSun);
  const up = cross3(toSun, side);
  const count = Math.ceil(delta * (40 + signal.energy * 160 + (hits.kick ? 400 : 0)) * scene.motion);
  for (let i = 0; i < count; i++) {
    const start = add3(add3(scale3(toSun, radius * 6), side, radius * signedRandom(7)), up, radius * signedRandom(7));
    scene.emit({
      at: start,
      velocity: scale3(toSun, -radius * randomRange(4, 6)),
      color: [0.35, 0.55, 1],
      life: 3,
      size: radius * randomRange(0.04, 0.08),
      gravity: -radius * 3,
    });
  }
};

function strike(scene: Scene, normal: V3, color: V3) {
  const { radius } = scene;
  const at = scale3(normal, radius * 1.015);
  scene.emit({ at, color, life: randomRange(0.15, 0.3), size: radius * randomRange(0.35, 0.6) });
  const along = tangentOf(normal);
  const other = cross3(normal, along);
  let point = at;
  for (let i = 0; i < 8; i++) {
    point = add3(add3(point, along, radius * signedRandom(0.12)), other, radius * signedRandom(0.12));
    scene.emit({ at: point, color, life: randomRange(0.1, 0.25), size: radius * randomRange(0.05, 0.12) });
  }
}

const lightning = (color: V3): Phenomenon => (scene, hits, _delta, local) => {
  if (!hits.snare) return;
  const normal = facing(scene.toCamera, 0.35);
  const flickers = 1 + Math.floor(Math.random() * 3);
  let struck = 0;
  local.events.push({
    age: 0,
    duration: 0.45,
    tick: (inner, age) => {
      if (struck >= flickers || age < struck * 0.13) return;
      struck++;
      strike(inner, normal, color);
    },
  });
};

const meteors = (trailColor: V3): Phenomenon => (scene, hits) => {
  if (!(hits.kick || (hits.hat && Math.random() < 0.3))) return;
  const { radius, toCamera } = scene;
  const target = facing(toCamera, 0.4);
  const start = scale3(normalize3(add3(target, randomUnit(), 0.9)), radius * randomRange(2.2, 3));
  const flight = randomRange(0.6, 1.1);
  scene.emit({
    at: start,
    velocity: scale3(add3(scale3(target, radius), start, -1), 1 / flight),
    color: [2, 1.4, 0.8],
    life: flight * 2,
    size: radius * 0.04,
    flags: ABSORB | TRAIL,
    trail: trailColor,
  });
};

const dustStorm: Phenomenon = (scene, hits, delta, local) => {
  const { radius } = scene;
  const center = local.storm;
  const count = Math.ceil(delta * (60 + signal.energy * 220 + (hits.kick ? 300 : 0)) * scene.motion);
  for (let i = 0; i < count; i++) {
    const normal = normalize3(add3(center, randomUnit(), randomRange(0.1, 0.7)));
    const at = scale3(normal, radius * randomRange(1.01, 1.07));
    scene.emit({
      at,
      velocity: scale3(cross3(center, normal), radius * randomRange(0.35, 0.6)),
      color: [0.95, 0.5, 0.25],
      life: randomRange(1.5, 2.5),
      size: radius * randomRange(0.04, 0.08),
      gravity: radius * 0.4,
      flags: ABSORB,
    });
  }
};

const collisions: Phenomenon = (scene, hits) => {
  if (!hits.kick && !hits.snare) return;
  const at = scale3(randomUnit(), BELT_CLEARANCE * randomRange(1.1, 2));
  scene.emit({ at, color: [2, 1.6, 1.2], life: 0.25, size: 0.7 });
  burst(scene, at, [1.8, 0.9, 0.4], 30, 2.5, 0.12);
};

const ringGlints: Phenomenon = (scene, hits) => {
  if (!hits.hat) return;
  const { body, radius, toCamera } = scene;
  const { inner, outer } = body.ring!;
  const cos = Math.cos(body.tilt);
  const sin = Math.sin(body.tilt);
  const facingAngle = Math.atan2(toCamera[2], toCamera[0]);
  for (let i = 0; i < 4; i++) {
    const angle = facingAngle + signedRandom(2.4);
    const distance = radius * randomRange(inner, outer);
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    scene.emit({ at: [x * cos, x * sin, z], color: [1.8, 1.6, 1.2], life: randomRange(0.3, 0.6), size: radius * randomRange(0.05, 0.1) });
  }
};

const comet: Phenomenon = (scene, hits, delta, local) => {
  local.sinceComet += delta;
  if (local.sinceComet < COMET_GAP_SECONDS || !(hits.kick || hits.snare)) return;
  local.sinceComet = 0;
  const { radius, toCamera } = scene;
  const across = normalize3(cross3(toCamera, [0, 1, 0]));
  const direction = Math.random() < 0.5 ? 1 : -1;
  const start = add3(add3(scale3(across, radius * 7 * direction), toCamera, radius * 1.6), [0, 1, 0], radius * signedRandom(2));
  const seconds = randomRange(6, 9);
  scene.emit({
    at: start,
    velocity: scale3(across, (-radius * 14 * direction) / seconds),
    color: [1.6, 1.9, 2.2],
    life: seconds,
    size: radius * 0.18,
    flags: TAIL,
    trail: [0.4, 0.75, 1.2],
  });
};

const PHENOMENA: Record<string, Phenomenon[]> = {
  Sun: [solarFlare],
  Mercury: [solarWind],
  Venus: [lightning([1.6, 1.5, 1.1])],
  Earth: [meteors([1.4, 0.7, 0.3])],
  Mars: [dustStorm],
  'Asteroid Belt': [collisions],
  Jupiter: [lightning([1.2, 1.4, 2])],
  Saturn: [ringGlints, lightning([1.4, 1.3, 1.6])],
  Uranus: [comet],
  Neptune: [comet, lightning([1, 1.3, 2])],
};

const createEdge = (high = 0.5, low = 0.2) => {
  let armed = true;
  return (value: number) => {
    if (armed && value > high) {
      armed = false;
      return true;
    }
    if (value < low) armed = true;
    return false;
  };
};

export type Phenomena = ReturnType<typeof createPhenomena>;

export function createPhenomena(THREE: ThreeModule) {
  const positions = new Float32Array(CAPACITY * 3);
  const tints = new Float32Array(CAPACITY * 3);
  const baseSizes = new Float32Array(CAPACITY);
  const alphas = new Float32Array(CAPACITY);
  const geometry = new THREE.BufferGeometry();
  const attribute = (array: Float32Array, size: number) => new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attribute(positions, 3));
  geometry.setAttribute('aColor', attribute(tints, 3));
  geometry.setAttribute('aSize', attribute(baseSizes, 1));
  geometry.setAttribute('aAlpha', attribute(alphas, 1));
  geometry.setDrawRange(0, 0);
  const uniforms = { uScale: { value: 1 } };
  const points = new THREE.Points(geometry, new THREE.ShaderMaterial({ vertexShader: PARTICLE_VERTEX, fragmentShader: PARTICLE_FRAGMENT, uniforms, ...additiveOptions(THREE) }));
  points.frustumCulled = false;
  points.visible = false;
  return {
    points,
    uniforms,
    positions,
    tints,
    baseSizes,
    alphas,
    velocities: new Float32Array(CAPACITY * 3),
    trails: new Float32Array(CAPACITY * 3),
    lives: new Float32Array(CAPACITY),
    spans: new Float32Array(CAPACITY),
    drags: new Float32Array(CAPACITY),
    gravities: new Float32Array(CAPACITY),
    flags: new Uint8Array(CAPACITY),
    count: 0,
    anchor: -1,
    local: { events: [], storm: [0, 1, 0], sinceComet: COMET_GAP_SECONDS } as LocalState,
    edges: { kick: createEdge(), snare: createEdge(), hat: createEdge(0.6, 0.25) },
  };
}

function emitter(system: Phenomena) {
  return ({ at, velocity = [0, 0, 0], color, life, size, drag = 0, gravity = 0, flags = 0, trail = color }: Spawn) => {
    if (system.count >= CAPACITY) return;
    const i = system.count++;
    system.positions.set(at, i * 3);
    system.velocities.set(velocity, i * 3);
    system.tints.set(color, i * 3);
    system.trails.set(trail, i * 3);
    system.lives[i] = system.spans[i] = life;
    system.baseSizes[i] = size;
    system.drags[i] = drag;
    system.gravities[i] = gravity;
    system.flags[i] = flags;
  };
}

function remove(system: Phenomena, i: number) {
  const last = --system.count;
  if (i === last) return;
  for (const [array, width] of [
    [system.positions, 3],
    [system.velocities, 3],
    [system.tints, 3],
    [system.trails, 3],
    [system.lives, 1],
    [system.spans, 1],
    [system.baseSizes, 1],
    [system.drags, 1],
    [system.gravities, 1],
    [system.flags, 1],
  ] as const) {
    array.copyWithin(i * width, last * width, last * width + width);
  }
}

function integrate(system: Phenomena, scene: Scene, delta: number) {
  const { positions, velocities, lives, drags, gravities, flags } = system;
  const { radius } = scene;
  let i = 0;
  while (i < system.count) {
    lives[i] -= delta;
    const p = i * 3;
    const at: V3 = [positions[p], positions[p + 1], positions[p + 2]];
    const distance = length3(at) || 1;
    if (lives[i] <= 0 || (flags[i] & ABSORB && distance < radius)) {
      if (flags[i] & ABSORB && lives[i] > 0 && flags[i] & TRAIL) {
        scene.emit({ at, color: [2, 1.2, 0.6], life: 0.2, size: radius * 0.2 });
      }
      remove(system, i);
      continue;
    }
    const pull = (gravities[i] * delta * (radius / distance) ** 2) / distance;
    const damping = Math.exp(-drags[i] * delta);
    for (let axis = 0; axis < 3; axis++) {
      velocities[p + axis] = (velocities[p + axis] - at[axis] * pull) * damping;
      positions[p + axis] += velocities[p + axis] * delta;
    }
    if (flags[i] & (TRAIL | TAIL)) {
      const trail: V3 = [system.trails[p], system.trails[p + 1], system.trails[p + 2]];
      const behind: V3 = flags[i] & TAIL ? scale3(scene.toSun, -radius * 0.5) : scale3([velocities[p], velocities[p + 1], velocities[p + 2]], -0.1);
      for (let n = 0; n < 2; n++) {
        scene.emit({ at, velocity: add3(behind, randomUnit(), radius * 0.08), color: trail, life: randomRange(0.4, 1.2), size: system.baseSizes[i] * randomRange(0.5, 0.9), drag: 0.5 });
      }
    }
    i++;
  }
}

function upload(system: Phenomena) {
  const { count, lives, spans, alphas, points } = system;
  for (let i = 0; i < count; i++) {
    const age = 1 - lives[i] / spans[i];
    alphas[i] = Math.min(1, age * 10) * (1 - age) ** 1.5;
  }
  const { attributes } = points.geometry;
  for (const name of ['position', 'aColor', 'aSize', 'aAlpha']) attributes[name].needsUpdate = true;
  points.geometry.setDrawRange(0, count);
  points.visible = count > 0;
}

function reset(system: Phenomena, anchor: number, toCamera: V3) {
  system.count = 0;
  system.anchor = anchor;
  system.local = { events: [], storm: facing(toCamera, 0.5), sinceComet: COMET_GAP_SECONDS };
}

export function animatePhenomena(stage: SolarStage, anchor: number, active: boolean) {
  const system = stage.phenomena;
  const { camera } = stage;
  const { delta } = clock;
  const center = stage.centers[anchor];
  const body = BODIES[anchor];
  const offset = camera.position.clone().sub(center);
  const toCamera: V3 = normalize3([offset.x, offset.y, offset.z]);
  if (anchor !== system.anchor) reset(system, anchor, toCamera);
  system.points.position.copy(center);
  system.uniforms.uScale.value = pointScale(camera);
  const scene: Scene = {
    body,
    radius: body.radius,
    toCamera,
    toSun: center.lengthSq() > 0 ? normalize3([-center.x, -center.y, -center.z]) : [0, 1, 0],
    motion: motionScale(),
    emit: emitter(system),
  };
  const hits: Hits = { kick: system.edges.kick(fx.kick), snare: system.edges.snare(fx.snare), hat: system.edges.hat(fx.hat) };
  if (active) {
    for (const phenomenon of PHENOMENA[body.name] ?? []) phenomenon(scene, hits, delta, system.local);
    system.local.storm = normalize3(add3(system.local.storm, cross3([0, 1, 0], system.local.storm), delta * STORM_DRIFT));
  }
  system.local.events = system.local.events.filter((event) => {
    event.age += delta;
    event.tick(scene, event.age, delta);
    return event.age < event.duration;
  });
  integrate(system, scene, delta);
  upload(system);
}

export function clearPhenomena(stage: SolarStage) {
  const system = stage.phenomena;
  system.count = 0;
  system.local.events = [];
  system.points.visible = false;
}

