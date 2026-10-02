import { bandAt } from '../audio/spectrum';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { approach } from '../math';
import { clock, fx, settings, signal, view } from '../state';

const TILE = 64;
const QUARTER_TURN = Math.PI / 2;
const BEAT_FLIP_SHARE = 0.12;
const DROP_FLIP_SHARE = 0.5;

let turns = new Float32Array(0);
let targets = new Float32Array(0);
let columnCount = 0;

function layout(columns: number, rows: number) {
  if (columnCount === columns && turns.length === columns * rows) return;
  columnCount = columns;
  targets = new Float32Array(columns * rows).map(() => (Math.random() < 0.5 ? 0 : 1));
  turns = targets.slice();
}

function flip(share: number) {
  for (let i = 0; i < targets.length; i++) if (Math.random() < share) targets[i]++;
}

export const flipTruchet = () => flip(BEAT_FLIP_SHARE);

export const scrambleTruchet = () => flip(DROP_FLIP_SHARE);

function drawTile(x: number, y: number, size: number, turn: number) {
  const half = size / 2;
  ctx.save();
  ctx.translate(x + half, y + half);
  ctx.rotate(turn * QUARTER_TURN);
  ctx.beginPath();
  ctx.arc(-half, -half, half, 0, QUARTER_TURN);
  ctx.moveTo(half, 0);
  ctx.arc(half, half, half, -QUARTER_TURN, -Math.PI, true);
  ctx.stroke();
  ctx.restore();
}

export function drawTruchet() {
  const { width, height, pixelRatio } = view;
  const size = Math.round(TILE * pixelRatio);
  const columns = Math.ceil(width / size) + 1;
  const rows = Math.ceil(height / size) + 1;
  layout(columns, rows);
  const offsetX = (width - columns * size) / 2;
  const offsetY = (height - rows * size) / 2;
  const rate = (6 + fx.drop * 10) * settings.motion;
  const cx = columns / 2;
  const cy = rows / 2;
  const reach = Math.hypot(cx, cy);
  const ripple = (clock.time - signal.lastBeat) * reach * 1.4;
  ctx.lineCap = 'round';
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column;
      turns[index] = approach(turns[index], targets[index], rate, clock.delta);
      const distance = Math.hypot(column - cx, row - cy);
      const level = bandAt(Math.floor((distance / reach) * 40), 40);
      const wave = Math.max(0, 1 - Math.abs(distance - ripple) / 2) * fx.beat;
      const intensity = Math.min(1, 0.15 + level * 0.9 + wave);
      ctx.lineWidth = size * (0.06 + intensity * 0.18);
      ctx.strokeStyle = color(distance / reach + turns[index] * 0.1, 0.3 + intensity * 0.7);
      drawTile(offsetX + column * size, offsetY + row * size, size, turns[index]);
    }
  }
}
