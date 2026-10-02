import type * as Three from 'three';
import { clamp01, smoothstep, TAU } from '../../math';
import { additiveOptions, type ThreeModule } from '../three-stage';
import { BODIES } from './bodies';
import type { SolarStage } from './scene';

const ORBIT_STEPS = 256;
const ORBIT_OPACITY = 0.22;
const MARKER_PIXELS = 7;
const NEAR_DISTANCE = 70;
const FAR_DISTANCE = 190;

const MARKER_VERTEX = `
  attribute vec3 color;
  uniform float uSize;
  varying vec3 vColor;
  void main() {
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize;
  }
`;

const MARKER_FRAGMENT = `
  uniform float uLevel;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float light = exp(-d * d * 6.0) + exp(-d * 3.0) * 0.25;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.3) * light * uLevel, 1.0);
  }
`;

export type SystemMap = ReturnType<typeof createSystemMap>;

const planets = () => BODIES.map((body, index) => ({ body, index })).filter(({ body }) => body.kind === 'planet');

function createOrbits(THREE: ThreeModule) {
  const rings = planets();
  const positions = new Float32Array(rings.length * ORBIT_STEPS * 6);
  let at = 0;
  for (const { body } of rings) {
    for (let step = 0; step < ORBIT_STEPS; step++) {
      for (const end of [step, step + 1]) {
        const angle = (end / ORBIT_STEPS) * TAU;
        positions.set([Math.cos(angle) * body.orbit, 0, Math.sin(angle) * body.orbit], at);
        at += 3;
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x8fb4ff, opacity: 0, ...additiveOptions(THREE) }));
}

function createMarkers(THREE: ThreeModule, centers: Three.Vector3[]) {
  const marked = planets();
  const positions = new Float32Array(marked.length * 3);
  const colors = new Float32Array(marked.length * 3);
  const color = new THREE.Color();
  marked.forEach(({ body, index }, i) => {
    centers[index].toArray(positions, i * 3);
    color.set(body.color).toArray(colors, i * 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const uniforms = { uSize: { value: MARKER_PIXELS }, uLevel: { value: 0 } };
  const material = new THREE.ShaderMaterial({ vertexShader: MARKER_VERTEX, fragmentShader: MARKER_FRAGMENT, uniforms, ...additiveOptions(THREE), depthTest: false });
  return { markers: new THREE.Points(geometry, material), uniforms };
}

export function createSystemMap(THREE: ThreeModule, centers: Three.Vector3[]) {
  const orbits = createOrbits(THREE);
  const { markers, uniforms } = createMarkers(THREE, centers);
  for (const object of [orbits, markers]) {
    object.frustumCulled = false;
    object.visible = false;
  }
  return { orbits, markers, uniforms };
}

export const mapLevel = (cameraDistance: number) => smoothstep(clamp01((cameraDistance - NEAR_DISTANCE) / (FAR_DISTANCE - NEAR_DISTANCE)));

export function animateSystemMap(stage: SolarStage, shown: boolean, beat: number) {
  const { orbits, markers, uniforms } = stage.systemMap;
  const level = shown ? mapLevel(stage.camera.position.length()) : 0;
  orbits.visible = markers.visible = level > 0.01;
  orbits.material.opacity = level * ORBIT_OPACITY * (1 + beat * 0.5);
  uniforms.uLevel.value = level * (1 + beat * 0.6);
  uniforms.uSize.value = MARKER_PIXELS * (stage.height / 1080 + 0.4) * (1 + beat * 0.3);
}
