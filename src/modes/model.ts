import type * as Three from 'three';
import type { MeshSurfaceSampler as Sampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { clock, fx, signal } from '../state';
import {
  additiveOptions,
  advanceSway,
  cameraJitter,
  createKick,
  createRenderer,
  fitStage,
  GLOW_POINT_FRAGMENT,
  glowLevel,
  lazyStage,
  normalizeGeometry,
  paint,
  paintPalette,
  pointScale,
  presentStage,
  sway,
  type ThreeModule,
} from './three-stage';

const POINT_COUNT = 24000;
const BASE_FOV = 45;
const ORBIT_RADIUS = 3.4;

const DISPLACE = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uBurst;
  float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z
    );
  }
  vec3 displaced(vec3 p, vec3 n) {
    float wave = noise3(p * 3.0 + vec3(0.0, uTime * 0.7, 0.0));
    float ripple = sin(length(p) * 14.0 - uTime * 6.0) * 0.5 + 0.5;
    float amount = wave * uBass * 0.35 + ripple * uMid * 0.06 + uBurst * (0.2 + wave * 1.3);
    return p + n * amount;
  }
`;

const POINT_VERTEX = `
  ${DISPLACE}
  uniform float uScale;
  uniform float uSize;
  uniform float uFade;
  attribute float aSeed;
  varying float vSeed;
  varying float vFade;
  void main() {
    vec4 eye = modelViewMatrix * vec4(displaced(position, normal), 1.0);
    gl_Position = projectionMatrix * eye;
    vSeed = aSeed;
    vFade = uFade * (0.6 + 0.4 * sin(uTime * 3.0 + aSeed * 60.0));
    gl_PointSize = clamp(uSize * (0.5 + aSeed) * uScale / max(-eye.z, 0.5), 1.0, 24.0);
  }
`;

const loadModules = () => Promise.all([import('three'), import('three/examples/jsm/math/MeshSurfaceSampler.js')]);

type Modules = Awaited<ReturnType<typeof loadModules>>;
type ModelStage = ReturnType<typeof buildStage>;

const SHAPES: ((THREE: ThreeModule) => Three.BufferGeometry)[] = [
  (THREE) => new THREE.TorusKnotGeometry(0.6, 0.22, 220, 36),
  (THREE) => new THREE.IcosahedronGeometry(1, 3),
  (THREE) => new THREE.TorusGeometry(0.7, 0.28, 48, 120),
  (THREE) => new THREE.OctahedronGeometry(1, 4),
];

const kick = createKick();
let shapeIndex = 0;
let dropping = false;

function injectDisplacement<T extends Three.Material>(material: T, uniforms: Record<string, Three.IUniform>) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = DISPLACE + shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = displaced(position, normal);');
  };
  return material;
}

function samplePoints(THREE: ThreeModule, MeshSurfaceSampler: typeof Sampler, geometry: Three.BufferGeometry) {
  const sampler = new MeshSurfaceSampler(new THREE.Mesh(geometry)).build();
  const positions = new Float32Array(POINT_COUNT * 3);
  const normals = new Float32Array(POINT_COUNT * 3);
  const seeds = new Float32Array(POINT_COUNT);
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let i = 0; i < POINT_COUNT; i++) {
    sampler.sample(point, normal);
    point.toArray(positions, i * 3);
    normal.toArray(normals, i * 3);
    seeds[i] = Math.random();
  }
  const points = new THREE.BufferGeometry();
  points.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  points.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  points.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  return points;
}

function useShape(stage: ModelStage, index: number) {
  const { THREE, MeshSurfaceSampler, solid, wire, points } = stage;
  const geometry = normalizeGeometry(SHAPES[index](THREE));
  solid.geometry.dispose();
  points.geometry.dispose();
  solid.geometry = wire.geometry = geometry;
  points.geometry = samplePoints(THREE, MeshSurfaceSampler, geometry);
}

function cycleShape(stage: ModelStage) {
  if (fx.drop > 0.9 && !dropping) {
    dropping = true;
    shapeIndex = (shapeIndex + 1) % SHAPES.length;
    useShape(stage, shapeIndex);
  } else if (fx.drop < 0.5) dropping = false;
}

function buildStage([THREE, { MeshSurfaceSampler }]: Modules) {
  const shared = { uTime: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 } };
  const solidUniforms = { ...shared, uBurst: { value: 0 } };
  const wireUniforms = { ...shared, uBurst: { value: 0 } };
  const pointUniforms = {
    ...shared,
    uBurst: { value: 0 },
    uScale: { value: 1 },
    uSize: { value: 0.012 },
    uFade: { value: 0 },
    uGlow: { value: 1 },
    uColorA: { value: new THREE.Color() },
    uColorB: { value: new THREE.Color() },
  };

  const solidMaterial = injectDisplacement(new THREE.MeshStandardMaterial({ metalness: 0.35, roughness: 0.35, flatShading: true }), solidUniforms);
  const wireMaterial = injectDisplacement(
    new THREE.MeshBasicMaterial({ wireframe: true, ...additiveOptions(THREE) }),
    wireUniforms,
  );
  const pointMaterial = new THREE.ShaderMaterial({
    vertexShader: POINT_VERTEX,
    fragmentShader: GLOW_POINT_FRAGMENT,
    uniforms: pointUniforms,
    ...additiveOptions(THREE),
  });

  const solid = new THREE.Mesh<Three.BufferGeometry, Three.MeshStandardMaterial>(new THREE.BufferGeometry(), solidMaterial);
  const wire = new THREE.Mesh<Three.BufferGeometry, Three.MeshBasicMaterial>(solid.geometry, wireMaterial);
  wire.scale.setScalar(1.015);
  const points = new THREE.Points(new THREE.BufferGeometry(), pointMaterial);
  const pivot = new THREE.Group();
  pivot.add(solid, wire, points);

  const lights = [new THREE.PointLight(0xffffff, 30, 0, 2), new THREE.PointLight(0xffffff, 30, 0, 2)];
  const scene = new THREE.Scene();
  scene.add(pivot, new THREE.AmbientLight(0xffffff, 0.15), ...lights);

  return {
    THREE,
    MeshSurfaceSampler,
    renderer: createRenderer(THREE),
    scene,
    camera: new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 50),
    shared,
    solidUniforms,
    wireUniforms,
    pointUniforms,
    solidMaterial,
    wireMaterial,
    solid,
    wire,
    points,
    pivot,
    lights,
    width: 0,
    height: 0,
  };
}

function createStage(modules: Modules) {
  const created = buildStage(modules);
  useShape(created, shapeIndex);
  return created;
}

const model = lazyStage(() => loadModules().then(createStage));

function updateUniforms(stage: ModelStage) {
  const { shared, solidUniforms, wireUniforms, pointUniforms, solidMaterial, wireMaterial, camera } = stage;
  const { gate, punchBass, punchMid, punchHigh, energy } = signal;
  shared.uTime.value = clock.time;
  shared.uBass.value = gate * (punchBass + kick.value * 0.6);
  shared.uMid.value = gate * punchMid;
  solidUniforms.uBurst.value = fx.drop * 0.25;
  wireUniforms.uBurst.value = fx.drop * 0.6;
  pointUniforms.uBurst.value = fx.drop * 1.6 + kick.value * 0.08;
  pointUniforms.uScale.value = pointScale(camera);
  pointUniforms.uSize.value = 0.012 + kick.value * 0.01 + punchHigh * 0.008;
  pointUniforms.uFade.value = Math.min(1, 0.25 + energy * 0.8 + punchHigh * 0.6 + fx.drop);
  pointUniforms.uGlow.value = glowLevel(kick.value);
  paintPalette(stage, pointUniforms.uColorA.value, pointUniforms.uColorB.value);
  paint(stage, solidMaterial.color, 0.25, 72);
  paint(stage, solidMaterial.emissive, 0.75, 20);
  solidMaterial.emissiveIntensity = 0.2 + kick.value * 0.9 + fx.drop;
  paint(stage, wireMaterial.color, 0.5);
  wireMaterial.opacity = Math.min(1, 0.08 + punchHigh * 0.7 + kick.value * 0.3 + fx.drop * 0.6);
}

function animate(stage: ModelStage) {
  const { pivot, lights } = stage;
  const { time } = clock;
  pivot.rotation.set(sway(0.21, 2) * 0.35 + kick.value * 0.08, time * 0.35 + fx.spin * 0.6, sway(0.17, 1, 1) * 0.15);
  pivot.scale.setScalar(1 + kick.value * 0.14 + signal.gate * signal.punchBass * 0.08);
  lights.forEach((light, i) => {
    const angle = time * (0.6 + i * 0.25) + i * Math.PI;
    light.position.set(Math.cos(angle) * 3, Math.sin(time * 0.4 + i) * 2, Math.sin(angle) * 3);
    paint(stage, light.color, i);
    light.intensity = 18 + kick.value * 40 + signal.punchMid * 20;
  });
}

function moveCamera(stage: ModelStage) {
  const { camera } = stage;
  const { time } = clock;
  advanceSway();
  const jitter = cameraJitter(0.12);
  const radius = ORBIT_RADIUS - kick.value * 0.25 + fx.drop * 0.8;
  camera.position.set(Math.sin(time * 0.13) * radius + jitter(), sway(0.09, 1) * 0.9 + jitter(), Math.cos(time * 0.13) * radius);
  camera.lookAt(0, 0, 0);
  camera.rotation.z += fx.spin * 0.2;
  camera.fov = BASE_FOV + kick.value * 4 + fx.drop * 18;
  camera.updateProjectionMatrix();
}

export function pulseModel() {
  kick.pulse();
}

export function drawModel() {
  const stage = model.get();
  if (!stage) return;
  kick.decay();
  cycleShape(stage);
  fitStage(stage);
  moveCamera(stage);
  animate(stage);
  updateUniforms(stage);
  presentStage(stage);
}
