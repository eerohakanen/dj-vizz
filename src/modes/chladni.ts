import { chladniSmall as plate, chladniSmallCtx as plateCtx, gradientCache, sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { approach, clamp01, smoothstep } from '../math';
import { clock, fx, settings, signal, view } from '../state';

const PIXEL = 4;
const BEATS_PER_SHAPE = 8;
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

const tint = gradientCache(() => plateCtx.createLinearGradient(0, 0, 1, 1));
let pixels: ImageData | null = null;
let cosColumnsN = new Float32Array(0);
let cosColumnsM = new Float32Array(0);
let cosRowsN = new Float32Array(0);
let cosRowsM = new Float32Array(0);
let shape = 0;
let beats = 0;
let n = SHAPES[0][0];
let m = SHAPES[0][1];

export function stepChladni() {
  beats++;
  if (beats % BEATS_PER_SHAPE === 0) shape = (shape + 1) % SHAPES.length;
}

export function jumpChladni() {
  shape = (shape + 1 + Math.floor(Math.random() * (SHAPES.length - 1))) % SHAPES.length;
}

function resizePlate(columns: number, rows: number) {
  if (pixels?.width === columns && pixels.height === rows) return;
  plate.width = columns;
  plate.height = rows;
  pixels = plateCtx.createImageData(columns, rows);
  cosColumnsN = new Float32Array(columns);
  cosColumnsM = new Float32Array(columns);
  cosRowsN = new Float32Array(rows);
  cosRowsM = new Float32Array(rows);
}

function fillCosines(target: Float32Array, frequency: number, count: number, aspect: number, phase: number) {
  for (let i = 0; i < count; i++) target[i] = Math.cos(frequency * Math.PI * (((i + 0.5) / count) * 2 - 1) * aspect + phase);
}

export function drawChladni() {
  const { width, height, pixelRatio, minSide } = view;
  const cellSize = Math.max(2, Math.round(PIXEL * pixelRatio));
  const columns = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  resizePlate(columns, rows);
  const [targetN, targetM] = SHAPES[shape];
  const rate = (1.2 + fx.drop * 6) * settings.motion;
  n = approach(n, targetN, rate, clock.delta);
  m = approach(m, targetM, rate, clock.delta);
  const wobble = Math.sin(clock.time * 0.4) * 0.25 * signal.gate;
  fillCosines(cosColumnsN, n, columns, width / minSide, wobble);
  fillCosines(cosColumnsM, m, columns, width / minSide, -wobble);
  fillCosines(cosRowsN, n, rows, height / minSide, -wobble);
  fillCosines(cosRowsM, m, rows, height / minSide, wobble);
  const line = 0.05 + signal.bass * 0.22 + fx.kick * 0.12;
  const glow = 0.25 + signal.mid * 0.6;
  const data = pixels!.data;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const value = Math.abs(cosColumnsN[column] * cosRowsM[row] - cosColumnsM[column] * cosRowsN[row]);
      const nodal = smoothstep(clamp01(1 - value / line));
      const alpha = Math.max(nodal, (1 - value) * glow * 0.35);
      const index = (row * columns + column) * 4 + 3;
      data[index] = alpha * 255;
    }
  }
  plateCtx.putImageData(pixels!, 0, 0);
  plateCtx.globalCompositeOperation = 'source-in';
  plateCtx.setTransform(columns, 0, 0, rows, 0, 0);
  plateCtx.fillStyle = tint(color(n * 0.13, 1), color(0.5 + m * 0.11, 1));
  plateCtx.fillRect(0, 0, 1, 1);
  plateCtx.setTransform(1, 0, 0, 1, 0, 0);
  plateCtx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(plate, 0, 0, columns * cellSize, rows * cellSize);
}
