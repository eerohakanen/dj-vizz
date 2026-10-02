import { color } from '../color';
import { approach, clamp01, smoothstep } from '../math';
import { clock, fx, settings, signal, view } from '../state';
import { createPlate } from './plate';
import { nextVariant, STYLE_RATE } from './restyle';

const BEATS_PER_SHAPE = 4;
const SHAPES: [number, number][] = [
  [1, 2],
  [1, 3],
  [2, 3],
  [1, 4],
  [3, 4],
  [2, 5],
  [3, 5],
  [1, 5],
  [4, 5],
  [3, 7],
  [2, 7],
  [5, 6],
];
const LOW_SHAPES: [number, number][] = [
  [1, 2],
  [1, 3],
  [2, 3],
  [1, 4],
  [3, 4],
  [2, 5],
];
const HIGH_SHAPES: [number, number][] = [
  [3, 5],
  [4, 5],
  [3, 7],
  [2, 7],
  [5, 6],
  [4, 7],
  [5, 8],
];
const ODD_SHAPES: [number, number][] = [
  [1, 3],
  [1, 5],
  [3, 5],
  [3, 7],
  [5, 7],
  [1, 7],
];
const VARIANTS = [
  { shapes: SHAPES, blend: 1, scale: 1 },
  { shapes: LOW_SHAPES, blend: -1, scale: 1.15 },
  { shapes: HIGH_SHAPES, blend: 1, scale: 0.85 },
  { shapes: ODD_SHAPES, blend: -1, scale: 1 },
  { shapes: SHAPES, blend: -1, scale: 0.9 },
];

const plate = createPlate(4);
let cosColumnsN = new Float32Array(0);
let cosColumnsM = new Float32Array(0);
let cosRowsN = new Float32Array(0);
let cosRowsM = new Float32Array(0);
let shape = 0;
let beats = 0;
let n = SHAPES[0][0];
let m = SHAPES[0][1];
let variant = 0;
let blend = VARIANTS[0].blend;
let scale = VARIANTS[0].scale;

const shapes = () => VARIANTS[variant].shapes;

export function stepChladni() {
  beats++;
  if (signal.downbeat || beats % BEATS_PER_SHAPE === 0) shape = (shape + 1) % shapes().length;
}

export function jumpChladni() {
  shape = (shape + 1 + Math.floor(Math.random() * (shapes().length - 1))) % shapes().length;
}

export function restyleChladni(strength: number) {
  variant = nextVariant(variant, VARIANTS.length, strength);
  const distances = shapes().map(([shapeN, shapeM]) => Math.hypot(shapeN - n, shapeM - m));
  shape = distances.indexOf(Math.min(...distances));
}

function fillCosines(target: Float32Array, frequency: number, count: number, aspect: number, phase: number) {
  for (let i = 0; i < count; i++) target[i] = Math.cos(frequency * Math.PI * (((i + 0.5) / count) * 2 - 1) * aspect + phase);
}

function fitTables(columns: number, rows: number) {
  if (cosColumnsN.length === columns && cosRowsN.length === rows) return;
  cosColumnsN = new Float32Array(columns);
  cosColumnsM = new Float32Array(columns);
  cosRowsN = new Float32Array(rows);
  cosRowsM = new Float32Array(rows);
}

export function drawChladni() {
  const { width, height, minSide } = view;
  const { columns, rows } = plate.fit();
  fitTables(columns, rows);
  const [targetN, targetM] = shapes()[shape];
  const rate = (4 + fx.drop * 8) * settings.motion;
  n = approach(n, targetN, rate, clock.delta);
  m = approach(m, targetM, rate, clock.delta);
  blend = approach(blend, VARIANTS[variant].blend, STYLE_RATE, clock.delta);
  scale = approach(scale, VARIANTS[variant].scale, STYLE_RATE, clock.delta);
  const pulse = (1 + fx.kick * 0.18 + fx.drop * 0.3) * scale;
  const wobble = Math.sin(clock.time * 0.7) * 0.3 * signal.gate + fx.hat * 0.08;
  fillCosines(cosColumnsN, n * pulse, columns, width / minSide, wobble);
  fillCosines(cosColumnsM, m * pulse, columns, width / minSide, -wobble);
  fillCosines(cosRowsN, n * pulse, rows, height / minSide, -wobble);
  fillCosines(cosRowsM, m * pulse, rows, height / minSide, wobble);
  const line = 0.03 + signal.punchBass * 0.2 + fx.kick * 0.22;
  const glow = signal.mid * 0.5 + fx.snare * 0.4;
  const gain = 0.35 + signal.gate * 0.45 + fx.beat * 0.4;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const value = Math.abs(cosColumnsN[column] * cosRowsM[row] - blend * cosColumnsM[column] * cosRowsN[row]);
      const nodal = smoothstep(clamp01(1 - value / line));
      plate.set(row * columns + column, clamp01(Math.max(nodal, (1 - value) * glow * 0.4) * gain));
    }
  }
  plate.present(color(n * 0.13 + fx.beat * 0.2, 1), color(0.5 + m * 0.11, 1, 58 + fx.kick * 25));
}
