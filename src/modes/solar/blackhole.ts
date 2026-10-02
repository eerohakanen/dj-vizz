import type * as Three from 'three';
import { clamp01, smoothstep } from '../../math';
import { motionScale } from '../../motion';
import { clock, signal } from '../../state';
import { additiveOptions, BILLBOARD_VERTEX, paint, paintPalette, type ThreeModule } from '../three-stage';
import { type Cataclysm, HOLE_RADIUS, phaseLevel } from './cataclysm';
import type { SolarStage } from './scene';

const DISK_INNER = 1.6;
const DISK_OUTER = 6;
const DISK_TILT = 0.18;
const HALO_SCALE = 3;
const SKY_DIM = 0.75;

const DISK_VERTEX = `
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DISK_FRAGMENT = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uSpin;
  uniform float uIntensity;
  uniform float uInner;
  uniform float uOuter;
  varying vec2 vLocal;
  void main() {
    float r = length(vLocal);
    float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
    float a = atan(vLocal.y, vLocal.x);
    float bands = 0.55 + 0.45 * sin(log(r) * 14.0 - uSpin * 3.0 + a * 2.0);
    float grain = 0.7 + 0.3 * sin(a * 23.0 + uSpin * 5.0 + r * 9.0);
    float edge = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.55, 1.0, t));
    float heat = pow(1.0 - t, 1.8);
    float doppler = 1.0 + 0.6 * sin(a);
    vec3 tint = mix(vec3(1.0, 0.95, 0.85), mix(uColorA, uColorB, t), smoothstep(0.0, 0.6, t));
    gl_FragColor = vec4(tint * (heat * 1.6 + 0.15) * bands * grain * edge * doppler * uIntensity, 1.0);
  }
`;

const HALO_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uSpin;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    vec2 c = (vUv * 2.0 - 1.0) * ${HALO_SCALE.toFixed(1)};
    float r = length(c);
    if (r < 1.0) discard;
    float a = atan(c.y, c.x);
    float photon = exp(-pow((r - 1.06) / 0.035, 2.0)) * 2.0;
    float lensed = exp(-pow((r - 1.3) / 0.16, 2.0)) * pow(abs(sin(a)), 1.5) * (0.6 + 0.4 * sin(a * 9.0 + uSpin * 4.0));
    float glow = exp(-(r - 1.0) * 2.2) * 0.35;
    float fade = 1.0 - smoothstep(${(HALO_SCALE * 0.8).toFixed(1)}, ${HALO_SCALE.toFixed(1)}, r);
    vec3 tint = mix(vec3(1.0, 0.92, 0.8), uColor, 0.35);
    gl_FragColor = vec4(tint * (photon + lensed + glow) * fade * uIntensity, 1.0);
  }
`;

export type BlackHole = ReturnType<typeof createBlackHole>;

export function createBlackHole(THREE: ThreeModule, sphere: Three.SphereGeometry) {
  const group = new THREE.Group();
  group.visible = false;
  const horizon = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const diskUniforms = {
    uColorA: { value: new THREE.Color() },
    uColorB: { value: new THREE.Color() },
    uSpin: { value: 0 },
    uIntensity: { value: 0 },
    uInner: { value: DISK_INNER },
    uOuter: { value: DISK_OUTER },
  };
  const disk = new THREE.Mesh(
    new THREE.RingGeometry(DISK_INNER, DISK_OUTER, 160, 6),
    new THREE.ShaderMaterial({ vertexShader: DISK_VERTEX, fragmentShader: DISK_FRAGMENT, uniforms: diskUniforms, ...additiveOptions(THREE), side: THREE.DoubleSide }),
  );
  disk.rotation.x = -Math.PI / 2 + DISK_TILT;
  const haloUniforms = { uRadius: { value: 0 }, uColor: { value: new THREE.Color() }, uSpin: { value: 0 }, uIntensity: { value: 0 } };
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: BILLBOARD_VERTEX, fragmentShader: HALO_FRAGMENT, uniforms: haloUniforms, ...additiveOptions(THREE), depthTest: false }),
  );
  halo.frustumCulled = false;
  halo.renderOrder = 1;
  const body = new THREE.Group();
  body.add(horizon, disk);
  group.add(body, halo);
  return { group, body, diskUniforms, haloUniforms };
}

export function animateBlackHole(stage: SolarStage, cataclysm: Cataclysm, kick: number) {
  const { group, body, diskUniforms, haloUniforms } = stage.blackHole;
  const collapse = phaseLevel(cataclysm, 'collapse');
  const dive = phaseLevel(cataclysm, 'dive');
  const grow = smoothstep(clamp01((collapse - 0.2) / 0.5));
  if (stage.skyMaterial.map) stage.skyMaterial.color.multiplyScalar(1 - SKY_DIM * smoothstep(collapse));
  group.visible = grow > 0;
  if (!group.visible) return;
  const size = HOLE_RADIUS * grow;
  body.scale.setScalar(size);
  const spin = (1 + signal.mid * 3 + kick * 2 + dive * 8) * clock.delta * motionScale();
  diskUniforms.uSpin.value += spin;
  diskUniforms.uIntensity.value = grow * (0.9 + signal.mid * 0.8 + kick * 0.6 + dive * 1.5);
  paintPalette(stage, diskUniforms.uColorA.value, diskUniforms.uColorB.value);
  haloUniforms.uRadius.value = size * HALO_SCALE;
  haloUniforms.uSpin.value = diskUniforms.uSpin.value;
  haloUniforms.uIntensity.value = grow * (0.8 + kick * 0.5 + dive * 2);
  paint(stage, haloUniforms.uColor.value, 0.5, 65);
}

export function clearBlackHole(stage: SolarStage) {
  stage.blackHole.group.visible = false;
}
