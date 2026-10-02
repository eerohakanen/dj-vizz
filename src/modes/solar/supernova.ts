import type * as Three from 'three';
import { clamp01, lerp, randomRange, signedRandom, smoothstep } from '../../math';
import { motionScale, shakeLevel } from '../../motion';
import { clock, fx } from '../../state';
import { additiveOptions, paint, type ThreeModule, withUniforms } from '../three-stage';
import { BELT_ORBIT, BODIES } from './bodies';
import { type Cataclysm, displace, phaseLevel, pullLevel, shockRadius, survival } from './cataclysm';
import type { SolarStage } from './scene';

const BODY_CHUNKS = 36;
const SPREAD = 0.08;
const SWELL = 0.03;
const SWELL_SCALE = 2.6;
const REMNANT_SCALE = 0.35;
const DUST_REACH = BELT_ORBIT - 8;
const SHARD_SEGMENTS = 32;
const SHARD_BLAST = 0.5;
const SHARD_BURN_SPAN = 0.45;
const EMBER_SIZE = 0.6;

const SHARD_HEADER = `
  attribute vec3 aCenter;
  attribute vec3 aParent;
  attribute vec3 aAxis;
  attribute float aSeed;
  uniform float uBlast;
  uniform float uPull;
  uniform float uBurn;
  varying vec3 vShardPoint;
  varying float vBurn;
`;

const SHARD_TRANSFORM = `
  vBurn = clamp((uBurn - 0.2 - aSeed * 0.5) / 0.3, 0.0, 1.0);
  vShardPoint = position + aSeed * 7.0;
  float crack = smoothstep(0.1, 0.45, uBurn - aSeed * 0.15);
  vec3 center = aParent + (aCenter - aParent) * (1.0 + crack * 2.5);
  vec3 local = position - aCenter;
  float turn = uBlast * (0.5 + aSeed) * 0.8 + crack * (aSeed - 0.5) * 3.0;
  local = local * cos(turn) + cross(aAxis, local) * sin(turn) + aAxis * dot(aAxis, local) * (1.0 - cos(turn));
  local *= (1.0 + uBlast * 0.08) * (1.0 - vBurn * 0.5);
  vec3 transformed = (center * (1.0 + uBlast * (0.6 + aSeed * 0.8)) + local) * (1.0 - uPull * 0.97);
`;

const EMBER_TRANSFORM = `${SHARD_TRANSFORM}
  transformed += (normalize(aCenter) + aAxis * 0.6) * vBurn * (0.15 + aSeed * 0.3) * (1.0 + uBlast * 0.3);
`;

const DISSOLVE_HEADER = `
  const vec3 EMBER = vec3(2.2, 0.8, 0.2);
  varying vec3 vShardPoint;
  varying float vBurn;
  float shardHash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }
  float shardNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(shardHash(i), shardHash(i + vec3(1, 0, 0)), f.x), mix(shardHash(i + vec3(0, 1, 0)), shardHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(shardHash(i + vec3(0, 0, 1)), shardHash(i + vec3(1, 0, 1)), f.x), mix(shardHash(i + vec3(0, 1, 1)), shardHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z
    );
  }
`;

const DISSOLVE_CUT = `
  float grain = shardNoise(vShardPoint * 16.0) * 0.65 + shardNoise(vShardPoint * 41.0) * 0.35;
  float burnLine = mix(-0.15, 1.0, vBurn);
  if (grain < burnLine) discard;
  float shardEdge = vBurn > 0.0 ? 1.0 - smoothstep(0.0, 0.12, grain - burnLine) : 0.0;
`;

const DISSOLVE_GLOW = `
  outgoingLight = mix(outgoingLight * (1.0 - vBurn * 0.6), EMBER, shardEdge);
  #include <opaque_fragment>
`;

const EMBER_HEADER = `
  varying float vBurn;
`;

const EMBER_GLOW = `
  float emberRadius = length(gl_PointCoord - 0.5) * 2.0;
  if (emberRadius > 1.0 || vBurn <= 0.0 || vBurn >= 1.0) discard;
  outgoingLight = diffuseColor.rgb * (1.0 - emberRadius) * (1.0 - emberRadius) * sin(vBurn * 3.14159);
`;

const SHELL_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.5);
    float filaments = 0.6 + 0.4 * sin(vLocal.x * 9.0 + uTime) * sin(vLocal.y * 11.0 - uTime * 1.3) * sin(vLocal.z * 7.0 + uTime * 0.7);
    gl_FragColor = vec4(mix(uColor, vec3(1.0), fresnel * 0.5) * (fresnel + 0.08) * filaments * uIntensity, 1.0);
  }
`;

interface Chunk {
  origin: Three.Vector3;
  offset: Three.Vector3;
  radius: number;
  reach: number;
  speed: number;
  axis: Three.Vector3;
  spin: number;
  scale: number;
}

export type Supernova = ReturnType<typeof createSupernova>;

function createChunks(THREE: ThreeModule, centers: Three.Vector3[]) {
  const chunks: Chunk[] = [];
  const colors: Three.Color[] = [];
  BODIES.forEach((body, i) => {
    if (body.kind !== 'planet' && body.kind !== 'moon') return;
    for (let n = 0; n < BODY_CHUNKS; n++) {
      chunks.push({
        origin: centers[i].clone(),
        offset: new THREE.Vector3(signedRandom(2), signedRandom(2), signedRandom(2)).normalize(),
        radius: body.radius * 0.6,
        reach: centers[i].length(),
        speed: randomRange(0.5, 1.5),
        axis: new THREE.Vector3(signedRandom(2), signedRandom(2), signedRandom(2)).normalize(),
        spin: randomRange(-3, 3),
        scale: body.radius * randomRange(0.12, 0.35),
      });
      colors.push(new THREE.Color(body.color));
    }
  });
  return { chunks, colors };
}

function createShardGeometry(THREE: ThreeModule) {
  const geometry = new THREE.SphereGeometry(1, SHARD_SEGMENTS, SHARD_SEGMENTS / 2).toNonIndexed();
  const { position } = geometry.attributes;
  const centers = new Float32Array(position.count * 3);
  const parents = new Float32Array(position.count * 3);
  const axes = new Float32Array(position.count * 3);
  const seeds = new Float32Array(position.count);
  const corner = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const centroid = (start: number, end: number) => {
    const center = new THREE.Vector3();
    for (let i = start; i < end; i++) center.add(corner.fromBufferAttribute(position, i));
    return center.divideScalar(end - start);
  };
  for (let start = 0; start < position.count; start += 3) {
    const pairStart = start - (start % 6);
    const center = centroid(start, start + 3);
    const parent = centroid(pairStart, Math.min(position.count, pairStart + 6));
    axis.set(signedRandom(2), signedRandom(2), signedRandom(2)).normalize();
    const seed = Math.random();
    for (let i = start; i < start + 3; i++) {
      center.toArray(centers, i * 3);
      parent.toArray(parents, i * 3);
      axis.toArray(axes, i * 3);
      seeds[i] = seed;
    }
  }
  geometry.setAttribute('aCenter', new THREE.BufferAttribute(centers, 3));
  geometry.setAttribute('aParent', new THREE.BufferAttribute(parents, 3));
  geometry.setAttribute('aAxis', new THREE.BufferAttribute(axes, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  return geometry;
}

function createShards(THREE: ThreeModule) {
  const material = new THREE.MeshBasicMaterial({ color: BODIES[0].color, side: THREE.DoubleSide });
  const shardUniforms = { uBlast: { value: 0 }, uPull: { value: 0 }, uBurn: { value: 0 } };
  withUniforms(material, 'shards', shardUniforms, (shader) => {
    shader.vertexShader = SHARD_HEADER + shader.vertexShader.replace('#include <begin_vertex>', SHARD_TRANSFORM);
    shader.fragmentShader = (DISSOLVE_HEADER + shader.fragmentShader)
      .replace('#include <alphatest_fragment>', DISSOLVE_CUT)
      .replace('#include <opaque_fragment>', DISSOLVE_GLOW);
  });
  const geometry = createShardGeometry(THREE);
  const shards = new THREE.Mesh(geometry, material);
  const emberMaterial = new THREE.PointsMaterial({ color: 0xffa040, size: EMBER_SIZE, ...additiveOptions(THREE) });
  withUniforms(emberMaterial, 'embers', shardUniforms, (shader) => {
    shader.vertexShader = SHARD_HEADER + shader.vertexShader.replace('#include <begin_vertex>', EMBER_TRANSFORM);
    shader.fragmentShader = (EMBER_HEADER + shader.fragmentShader).replace('outgoingLight = diffuseColor.rgb;', EMBER_GLOW);
  });
  const embers = new THREE.Points(geometry, emberMaterial);
  for (const object of [shards, embers]) {
    object.frustumCulled = false;
    object.visible = false;
  }
  return { shards, embers, shardUniforms };
}

export function createSupernova(THREE: ThreeModule, sphere: Three.SphereGeometry, vertexShader: string, centers: Three.Vector3[]) {
  const shellUniforms = { uColor: { value: new THREE.Color() }, uIntensity: { value: 0 }, uTime: { value: 0 } };
  const shell = new THREE.Mesh(sphere, new THREE.ShaderMaterial({ vertexShader, fragmentShader: SHELL_FRAGMENT, uniforms: shellUniforms, ...additiveOptions(THREE), side: THREE.DoubleSide }));
  shell.visible = false;
  const { chunks, colors } = createChunks(THREE, centers);
  const debrisMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, emissive: 0xff6a20, emissiveIntensity: 0 });
  const debris = new THREE.InstancedMesh<Three.BufferGeometry, Three.MeshStandardMaterial>(new THREE.IcosahedronGeometry(1, 1), debrisMaterial, chunks.length);
  colors.forEach((color, i) => debris.setColorAt(i, color));
  debris.frustumCulled = false;
  debris.visible = false;
  return { shell, shellUniforms, debris, chunks, ...createShards(THREE) };
}

function sunScale(level: number, collapse: number, kick: number) {
  if (level < SWELL) return lerp(1, SWELL_SCALE, level / SWELL);
  return REMNANT_SCALE * (1 + kick * 0.3) * (1 - smoothstep(clamp01(collapse / 0.5)));
}

function animateShards(supernova: Supernova, level: number, shock: number, pull: number) {
  const { shards, embers, shardUniforms } = supernova;
  const burst = BODIES[0].radius * SWELL_SCALE;
  const burn = clamp01((level - SWELL) / SHARD_BURN_SPAN);
  shards.visible = embers.visible = level >= SWELL && burn < 1 && pull < 1;
  shards.scale.setScalar(burst);
  embers.scale.setScalar(burst);
  shardUniforms.uBlast.value = (Math.max(0, shock - burst) * SHARD_BLAST) / burst;
  shardUniforms.uPull.value = pull;
  shardUniforms.uBurn.value = burn;
  const heat = 1 + 3 * (1 - level) ** 2 + fx.kick * 0.5;
  shards.material.color.setRGB(heat, heat * lerp(0.9, 0.45, level), heat * lerp(0.8, 0.2, level));
}

function animateSun(stage: SolarStage, level: number, collapse: number, kick: number) {
  const { sun, sunlight, corona } = stage;
  const scale = sunScale(level, collapse, kick);
  sun.visible = scale > 0.001;
  sun.scale.setScalar(BODIES[0].radius * scale);
  const blaze = 1 + 6 * (1 - level) ** 3;
  const cool = smoothstep(level);
  (sun.material as Three.MeshBasicMaterial).color.setRGB(blaze * lerp(1, 0.8, cool), blaze * lerp(0.95, 0.9, cool), blaze * lerp(0.85, 1.3, cool));
  const fading = 1 - collapse;
  sunlight.intensity = (3 + 25 * (1 - level) ** 3 + kick * 4) * fading;
  const { uniforms } = corona;
  uniforms.uRadius.value = BODIES[0].radius * 4 * Math.max(scale, 0.2) * (1 + 3 * (1 - level) ** 2);
  uniforms.uIntensity.value = (1.5 + 8 * (1 - level) ** 2 + kick + fx.snare * 2) * fading;
}

function animateShell(stage: SolarStage, supernova: Supernova, level: number, shock: number, kick: number) {
  const { shell, shellUniforms } = supernova;
  shell.visible = level > 0 && level < 1;
  shell.scale.setScalar(shock);
  shellUniforms.uTime.value = clock.time;
  shellUniforms.uIntensity.value = 2.5 * (1 - level) ** 1.2 * (0.8 + kick * 0.5);
  paint(stage, shellUniforms.uColor.value, 0, 60);
}

function animateDebris(stage: SolarStage, supernova: Supernova, level: number, shock: number, pull: number) {
  const { debris, chunks } = supernova;
  const { scratch } = stage;
  const motion = motionScale();
  const burst = 1 + fx.kick * 0.4 * motion;
  debris.visible = level > 0 && pull < 1;
  debris.material.emissiveIntensity = 1 + 3 * (1 - level) ** 2 + fx.snare;
  chunks.forEach((chunk, i) => {
    const hit = shock - chunk.reach;
    const size = hit > 0 ? chunk.scale * burst * (1 - pull) * survival(shock, chunk.reach) : 0;
    const flung = chunk.radius + Math.max(0, hit) * SPREAD * chunk.speed * burst;
    const point = displace(scratch.position.copy(chunk.origin).addScaledVector(chunk.offset, flung), shock, pull);
    scratch.position.set(point.x, point.y, point.z);
    scratch.quaternion.setFromAxisAngle(chunk.axis, clock.time * chunk.spin * motion);
    scratch.scale.setScalar(size);
    scratch.updateMatrix();
    debris.setMatrixAt(i, scratch.matrix);
  });
  debris.instanceMatrix.needsUpdate = true;
}

export function animateSupernova(stage: SolarStage, cataclysm: Cataclysm, kick: number) {
  const level = phaseLevel(cataclysm, 'supernova');
  const collapse = phaseLevel(cataclysm, 'collapse');
  const shock = shockRadius(cataclysm);
  const pull = pullLevel(cataclysm);
  stage.planets.forEach((planet) => {
    planet.group.visible = shock < planet.reach;
  });
  stage.dust.visible = shock < DUST_REACH;
  animateSun(stage, level, collapse, kick);
  animateShards(stage.supernova, level, shock, pull);
  animateShell(stage, stage.supernova, level, shock, kick);
  animateDebris(stage, stage.supernova, level, shock, pull);
  fx.shake = Math.max(fx.shake, (1 - level) * 0.9 * shakeLevel());
}

export function clearSupernova(stage: SolarStage) {
  stage.planets.forEach((planet) => {
    planet.group.visible = true;
  });
  stage.dust.visible = true;
  stage.sun.visible = true;
  stage.sun.scale.setScalar(BODIES[0].radius);
  stage.supernova.shell.visible = false;
  stage.supernova.shards.visible = false;
  stage.supernova.embers.visible = false;
  stage.supernova.debris.visible = false;
}
