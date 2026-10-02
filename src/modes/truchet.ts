import { bandAt } from '../audio/spectrum';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { approach } from '../math';
import { clock, fx, settings, signal, view } from '../state';
import { glideStyle, nextVariant } from './restyle';

const TILE = 64;
const QUARTER_TURN = Math.PI / 2;
const BEAT_FLIP_SHARE = 0.2;
const DROP_FLIP_SHARE = 0.5;
const CIRCLE_BEND = 0.5523;
const VARIANTS = [
  { scale: 1, bend: CIRCLE_BEND, weight: 1 },
  { scale: 0.65, bend: 0, weight: 0.85 },
  { scale: 1.4, bend: 0.95, weight: 1.1 },
  { scale: 0.8, bend: 0.25, weight: 1.3 },
  { scale: 1.2, bend: CIRCLE_BEND, weight: 0.7 },
];
const MIN_SCALE = Math.min(...VARIANTS.map((entry) => entry.scale));

let turns = new Float32Array(0);
let targets = new Float32Array(0);
let columnCount = 0;
let variant = 0;
const style = { ...VARIANTS[0] };

function layout(columns: number, rows: number) {
  if (columnCount === columns && turns.length === columns * rows) return;
  columnCount = columns;
  targets = new Float32Array(columns * rows).map(() => (Math.random() < 0.5 ? 0 : 1));
  turns = targets.slice();
}

function flip(share: number) {
  for (let i = 0; i < targets.length; i++) if (Math.random() < share) targets[i]++;
}

export const flipTruchet = () => flip(BEAT_FLIP_SHARE * (0.6 + signal.punchBass));

export const scrambleTruchet = () => flip(DROP_FLIP_SHARE);

export function restyleTruchet(strength: number) {
  variant = nextVariant(variant, VARIANTS.length, strength);
}

function drawTile(x: number, y: number, size: number, turn: number) {
  const half = size / 2;
  const pull = half * style.bend;
  ctx.save();
  ctx.translate(x + half, y + half);
  ctx.rotate(turn * QUARTER_TURN);
  ctx.beginPath();
  ctx.moveTo(0, -half);
  ctx.bezierCurveTo(0, pull - half, pull - half, 0, -half, 0);
  ctx.moveTo(half, 0);
  ctx.bezierCurveTo(half - pull, 0, 0, half - pull, 0, half);
  ctx.stroke();
  ctx.restore();
}

const spanOf = (length: number, size: number) => Math.ceil(length / size) + 1;

function paddedSpan(length: number, size: number) {
  const span = spanOf(length, size);
  return span + 2 * Math.ceil((spanOf(length, size * MIN_SCALE) - span) / 2);
}

export function drawTruchet() {
  const { width, height, pixelRatio } = view;
  glideStyle(style, VARIANTS[variant]);
  const baseSize = Math.round(TILE * pixelRatio);
  const size = baseSize * style.scale;
  const columns = paddedSpan(width, baseSize);
  const rows = paddedSpan(height, baseSize);
  layout(columns, rows);
  const originX = width / 2 - (columns / 2) * size;
  const originY = height / 2 - (rows / 2) * size;
  const rate = (8 + fx.drop * 10 + fx.kick * 6) * settings.motion;
  const cx = columns / 2;
  const cy = rows / 2;
  const reach = Math.hypot(spanOf(width, baseSize), spanOf(height, baseSize)) / 2 / style.scale;
  const ripple = (clock.time - signal.lastBeat) * reach * 1.4;
  ctx.lineCap = 'round';
  for (let row = 0; row < rows; row++) {
    const y = originY + row * size;
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column;
      turns[index] = approach(turns[index], targets[index], rate, clock.delta);
      const x = originX + column * size;
      if (x > width + size / 2 || y > height + size / 2 || x + size * 1.5 < 0 || y + size * 1.5 < 0) continue;
      const distance = Math.hypot(column - cx, row - cy);
      const level = bandAt(Math.floor((distance / reach) * 40), 40);
      const wave = Math.max(0, 1 - Math.abs(distance - ripple) / 2) * (0.4 + fx.beat);
      const intensity = Math.min(1, 0.05 + level * 1.4 + wave + fx.snare * 0.3);
      ctx.lineWidth = size * (0.03 + intensity * 0.3) * style.weight;
      ctx.strokeStyle = color(distance / reach + turns[index] * 0.1, 0.3 + intensity * 0.7);
      drawTile(x, y, size, turns[index]);
    }
  }
}
