import type * as Three from 'three';
import { randomRange, signedRandom, TAU } from '../../math';
import {
  additiveOptions,
  BILLBOARD_VERTEX,
  createRenderer,
  createStarGeometry,
  STREAK_FRAGMENT,
  STREAK_VERTEX,
  SUN_FRAGMENT,
  type ThreeModule,
  type Uniforms,
  withUniforms,
} from '../three-stage';
import { createTextureLoader, loadAsteroid, type Modules } from './assets';
import { createBlackHole } from './blackhole';
import { BELT_ANGLE, BELT_CLEARANCE, BELT_ORBIT, BODIES, type Body, orbitPoint, SKY_TEXTURE } from './bodies';
import { createPhenomena } from './phenomena';
import { createSupernova } from './supernova';
import { createSystemMap } from './systemMap';

export const BASE_FOV = 55;
const FAR = 1500;
const SKY_RADIUS = 900;
const CORONA_SCALE = 4;
const RIM_SCALE = 1.05;
const CLOUD_SCALE = 1.015;
const AURORA_SCALE = 1.08;
const RING_RINGS = 24;
export const STREAK_CUBE = 120;
const STREAK_COUNT = 2500;
const CLUSTER_COUNT = 90;
const SCATTER_COUNT = 50;
const CLUSTER_SPREAD = 0.12;
const DUST_COUNT = 5000;
const BELT_WIDTH = 5;

const RIM_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 eye = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-eye.xyz);
    gl_Position = projectionMatrix * eye;
  }
`;

const RIM_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 3.0);
    gl_FragColor = vec4(uColor * fresnel * uIntensity, 1.0);
  }
`;

const SHELL_VERTEX = `
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 eye = modelViewMatrix * vec4(position, 1.0);
    vLocal = position;
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-eye.xyz);
    gl_Position = projectionMatrix * eye;
  }
`;

const AURORA_FRAGMENT = `
  uniform float uTime;
  uniform float uIntensity;
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float latitude = abs(vLocal.y);
    float band = smoothstep(0.7, 0.8, latitude) * (1.0 - smoothstep(0.9, 0.97, latitude));
    float longitude = atan(vLocal.z, vLocal.x);
    float curtain = 0.5 + 0.5 * sin(longitude * 18.0 + uTime * 1.5 + sin(longitude * 5.0 - uTime) * 2.0);
    float edge = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 1.5);
    vec3 tint = mix(vec3(0.2, 1.0, 0.5), vec3(0.8, 0.3, 1.0), smoothstep(0.8, 0.95, latitude));
    gl_FragColor = vec4(tint * band * curtain * (0.4 + edge) * uIntensity, 1.0);
  }
`;

const SWIRL = `
  uniform float uSwirl;
  uniform float uWobble;
  vec2 swirlUv(vec2 uv) {
    float latitude = uv.y - 0.5;
    uv.x += sin(latitude * 26.0) * sin(uSwirl * 0.4) * 0.025;
    uv.y += sin(uv.x * 37.7 + uSwirl * 2.0) * uWobble * 0.004;
    return uv;
  }
`;

const RIPPLE = `
  uniform float uRipple;
  uniform float uRippleAmount;
  uniform float uRadius;
`;

const RIPPLE_VERTEX = `
  vec3 transformed = vec3(position);
  transformed.z += sin(length(position.xy) / uRadius * 18.0 - uRipple) * uRippleAmount * uRadius;
`;

export type SolarStage = ReturnType<typeof buildStage>;

export interface Asteroid {
  position: Three.Vector3;
  push: Three.Vector3;
  axis: Three.Vector3;
  spin: number;
  scale: number;
}

export interface Planet {
  body: Body;
  group: Three.Object3D;
  reach: number;
  spinner: Three.Object3D;
  clouds?: Three.Object3D;
  rim?: Three.ShaderMaterial;
  swirl?: Uniforms;
  ripple?: Uniforms;
  aurora?: Uniforms;
}

function texturedMaterial(THREE: ThreeModule, load: ReturnType<typeof createTextureLoader>, body: Body) {
  const material = new THREE.MeshStandardMaterial({ color: body.color, roughness: 1, metalness: 0 });
  if (body.texture)
    load(body.texture, (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    });
  if (body.signature !== 'swirl') return { material };
  const swirl = withUniforms(material, 'swirl', { uSwirl: { value: 0 }, uWobble: { value: 0 } }, (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${SWIRL}`)
      .replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', 'texture2D( map, swirlUv( vMapUv ) )'));
  });
  return { material, swirl };
}

function createRing(THREE: ThreeModule, load: ReturnType<typeof createTextureLoader>, body: Body) {
  const { inner, outer, texture } = body.ring!;
  const geometry = new THREE.RingGeometry(inner * body.radius, outer * body.radius, 128, RING_RINGS);
  const { position, uv } = geometry.attributes;
  for (let i = 0; i < position.count; i++) {
    const distance = Math.hypot(position.getX(i), position.getY(i)) / body.radius;
    uv.setXY(i, (distance - inner) / (outer - inner), 0.5);
  }
  const material = new THREE.MeshStandardMaterial({ color: body.color, side: THREE.DoubleSide, transparent: true, opacity: 0.7, depthWrite: false, roughness: 1 });
  load(texture, (map) => {
    material.map = map;
    material.color.set(0xffffff);
    material.opacity = 1;
    material.needsUpdate = true;
  });
  const ripple = withUniforms(material, 'ripple', { uRipple: { value: 0 }, uRippleAmount: { value: 0 }, uRadius: { value: body.radius } }, (shader) => {
    shader.vertexShader = RIPPLE + shader.vertexShader.replace('#include <begin_vertex>', RIPPLE_VERTEX);
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.rotation.x = -Math.PI / 2;
  return { ring, ripple };
}

function createPlanet(THREE: ThreeModule, load: ReturnType<typeof createTextureLoader>, body: Body, sphere: Three.SphereGeometry, center: Three.Vector3) {
  const group = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.z = body.tilt;
  group.add(tilt);
  const { material, swirl } = texturedMaterial(THREE, load, body);
  const spinner = new THREE.Mesh(sphere, material);
  spinner.scale.setScalar(body.radius);
  tilt.add(spinner);
  const planet: Planet = { body, group, reach: center.length(), spinner, swirl };
  if (body.clouds) {
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, depthWrite: false, roughness: 1 });
    const clouds = new THREE.Mesh(sphere, material);
    clouds.visible = false;
    clouds.scale.setScalar(body.radius * CLOUD_SCALE);
    load(
      body.clouds,
      (texture) => {
        material.alphaMap = texture;
        material.needsUpdate = true;
        clouds.visible = true;
      },
      THREE.NoColorSpace,
    );
    tilt.add(clouds);
    planet.clouds = clouds;
  }
  if (body.rim) {
    const rim = new THREE.ShaderMaterial({
      vertexShader: RIM_VERTEX,
      fragmentShader: RIM_FRAGMENT,
      uniforms: { uColor: { value: new THREE.Color(body.rim) }, uIntensity: { value: 0 } },
      ...additiveOptions(THREE),
    });
    const shell = new THREE.Mesh(sphere, rim);
    shell.scale.setScalar(body.radius * RIM_SCALE);
    tilt.add(shell);
    planet.rim = rim;
  }
  if (body.signature === 'aurora') {
    const uniforms = { uTime: { value: 0 }, uIntensity: { value: 0 } };
    const shell = new THREE.Mesh(sphere, new THREE.ShaderMaterial({ vertexShader: SHELL_VERTEX, fragmentShader: AURORA_FRAGMENT, uniforms, ...additiveOptions(THREE) }));
    shell.scale.setScalar(body.radius * AURORA_SCALE);
    tilt.add(shell);
    planet.aurora = uniforms;
  }
  if (body.ring) {
    const { ring, ripple } = createRing(THREE, load, body);
    tilt.add(ring);
    planet.ripple = ripple;
  }
  group.position.copy(center);
  return planet;
}

function beltPoint(THREE: ThreeModule, angle: number, radial: number, height: number) {
  const distance = BELT_ORBIT + radial;
  return new THREE.Vector3(Math.cos(angle) * distance, height, -Math.sin(angle) * distance);
}

function createAsteroids(THREE: ThreeModule, center: Three.Vector3) {
  const asteroids: Asteroid[] = [];
  const place = (angleSpread: number, scaleMax: number) => {
    for (;;) {
      const position = beltPoint(THREE, BELT_ANGLE + signedRandom(angleSpread * 2), signedRandom(BELT_WIDTH * 1.2), signedRandom(2.4));
      if (position.distanceTo(center) < BELT_CLEARANCE) continue;
      const axis = new THREE.Vector3(signedRandom(2), signedRandom(2), signedRandom(2)).normalize();
      const push = position.clone().sub(center).normalize();
      asteroids.push({ position, push, axis, spin: randomRange(-0.6, 0.6), scale: randomRange(0.04, scaleMax) });
      return;
    }
  };
  for (let i = 0; i < CLUSTER_COUNT; i++) place(CLUSTER_SPREAD, 0.35);
  for (let i = 0; i < SCATTER_COUNT; i++) place(Math.PI, 0.5);
  return asteroids;
}

function createDust(THREE: ThreeModule) {
  const positions = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) beltPoint(THREE, Math.random() * TAU, signedRandom(BELT_WIDTH * 2), signedRandom(2)).toArray(positions, i * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x9d8f80, size: 0.06, transparent: true, opacity: 0.7, depthWrite: false }));
}

function prewarm(renderer: Three.WebGLRenderer, scene: Three.Scene, camera: Three.Camera, hidden: Three.Object3D[]) {
  hidden.forEach((object) => {
    object.visible = true;
  });
  renderer.compile(scene, camera);
  hidden.forEach((object) => {
    object.visible = false;
  });
}

export function buildStage(modules: Modules) {
  const [THREE] = modules;
  const renderer = createRenderer(THREE);
  const load = createTextureLoader(modules);
  const scene = new THREE.Scene();
  const sphere = new THREE.SphereGeometry(1, 64, 32);

  const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, depthWrite: false });
  load(SKY_TEXTURE, (texture) => {
    skyMaterial.map = texture;
    skyMaterial.needsUpdate = true;
  });
  const sky = new THREE.Mesh(sphere, skyMaterial);
  sky.scale.setScalar(SKY_RADIUS);
  sky.renderOrder = -1;
  scene.add(sky);

  scene.add(new THREE.AmbientLight(0xffffff, 0.06));
  const sunlight = new THREE.PointLight(0xffffff, 3, 0, 0);
  scene.add(sunlight);

  const [sunBody] = BODIES;
  const sunMaterial = new THREE.MeshBasicMaterial({ color: sunBody.color });
  const sun = new THREE.Mesh(sphere, sunMaterial);
  sun.scale.setScalar(sunBody.radius);
  scene.add(sun);
  const corona = new THREE.ShaderMaterial({
    vertexShader: BILLBOARD_VERTEX,
    fragmentShader: SUN_FRAGMENT,
    uniforms: {
      uRadius: { value: sunBody.radius * CORONA_SCALE },
      uColor: { value: new THREE.Color() },
      uTime: { value: 0 },
      uSpin: { value: 0 },
      uIntensity: { value: 1 },
    },
    ...additiveOptions(THREE),
  });
  const coronaMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), corona);
  coronaMesh.frustumCulled = false;
  scene.add(coronaMesh);

  const centers = BODIES.map((body) => {
    const { x, z } = orbitPoint(body);
    return new THREE.Vector3(x, 0, z);
  });

  const planets: Planet[] = [];
  BODIES.forEach((body, i) => {
    if (body.kind !== 'planet' && body.kind !== 'moon') return;
    const planet = createPlanet(THREE, load, body, sphere, centers[i]);
    scene.add(planet.group);
    planets.push(planet);
  });

  const beltCenter = centers[BODIES.findIndex((body) => body.kind === 'belt')];
  const asteroids = createAsteroids(THREE, beltCenter);
  const belt = new THREE.InstancedMesh<Three.BufferGeometry, Three.MeshStandardMaterial>(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0x8a7b6d, roughness: 1, metalness: 0 }),
    asteroids.length,
  );
  belt.frustumCulled = false;
  const dust = createDust(THREE);
  const supernova = createSupernova(THREE, sphere, SHELL_VERTEX, centers);
  const blackHole = createBlackHole(THREE, sphere);
  load(sunBody.texture!, (texture) => {
    for (const material of [sunMaterial, supernova.shards.material]) {
      material.map = texture;
      material.needsUpdate = true;
    }
  });
  const systemMap = createSystemMap(THREE, centers);
  const phenomena = createPhenomena(THREE);
  scene.add(belt, dust, systemMap.orbits, systemMap.markers, phenomena.points, supernova.shell, supernova.shards, supernova.embers, supernova.debris, blackHole.group);
  loadAsteroid(modules, (geometry) => {
    belt.geometry.dispose();
    belt.geometry = geometry;
  });

  const streakUniforms = {
    uOffset: { value: new THREE.Vector3() },
    uCube: { value: STREAK_CUBE },
    uFieldRadius: { value: STREAK_CUBE / 2 },
    uStreak: { value: 0 },
    uStreakAlpha: { value: 0 },
    uHeading: { value: new THREE.Vector3(0, 0, -1) },
    uColorA: { value: new THREE.Color() },
    uColorB: { value: new THREE.Color() },
  };
  const streaks = new THREE.LineSegments(
    createStarGeometry(THREE, STREAK_COUNT, STREAK_CUBE).streaks,
    new THREE.ShaderMaterial({ vertexShader: STREAK_VERTEX, fragmentShader: STREAK_FRAGMENT, uniforms: streakUniforms, ...additiveOptions(THREE), depthTest: false }),
  );
  streaks.frustumCulled = false;
  scene.add(streaks);

  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, FAR);
  camera.position.copy(centers[0]).add(new THREE.Vector3(0, 0, BODIES[0].view));
  prewarm(renderer, scene, camera, [systemMap.orbits, systemMap.markers, supernova.shell, supernova.shards, supernova.embers, supernova.debris, blackHole.group]);

  return {
    THREE,
    renderer,
    scene,
    camera,
    sky,
    skyMaterial,
    sunlight,
    sun,
    corona,
    planets,
    centers,
    asteroids,
    belt,
    dust,
    supernova,
    systemMap,
    phenomena,
    blackHole,
    streaks,
    streakUniforms,
    lookTarget: new THREE.Vector3(),
    origin: new THREE.Vector3(),
    previous: camera.position.clone(),
    velocity: new THREE.Vector3(),
    scratch: new THREE.Object3D(),
    width: 0,
    height: 0,
  };
}
