import { bandAt } from '../audio/spectrum';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { clock, fx, signal, view } from '../state';
import { glideStyle, nextVariant } from './restyle';

const SIXTH_TURN = Math.PI / 3;
const TWELFTH_TURN = Math.PI / 6;
const VARIANTS = [
  { scale: 1, turn: 0, base: 0.15, spread: 0.8 },
  { scale: 0.62, turn: 1, base: 0.1, spread: 0.8 },
  { scale: 1.45, turn: 0, base: 0.22, spread: 0.6 },
  { scale: 0.8, turn: 1, base: 0.04, spread: 0.95 },
  { scale: 1.2, turn: 0.5, base: 0.12, spread: 0.7 },
];

let variant = 0;
const style = { ...VARIANTS[0] };

export function restyleHex(strength: number) {
  variant = nextVariant(variant, VARIANTS.length, strength);
}

function drawHexagon(x: number, y: number, radius: number) {
  ctx.beginPath();
  for (let j = 0; j < 6; j++) {
    const angle = j * SIXTH_TURN + TWELFTH_TURN * (1 + style.turn) + fx.spin * 0.5;
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  ctx.fill();
}

const rippleAt = (distance: number, front: number, width: number) => Math.max(0, 1 - Math.abs(distance - front) / width);

export function drawHex() {
  const { width, height, pixelRatio } = view;
  glideStyle(style, VARIANTS[variant]);
  const size = 58 * pixelRatio * style.scale;
  const columnStep = size * Math.sqrt(3);
  const rowStep = size * 1.5;
  const cx = width / 2;
  const cy = height / 2;
  const originX = cx * (1 - style.scale);
  const originY = cy * (1 - style.scale);
  const reach = Math.hypot(cx, cy);
  const ripple = (clock.time - signal.lastBeat) * reach * 1.6;
  const dropRipple = (clock.time - signal.lastDrop) * reach * 0.9;
  for (let row = Math.floor(-originY / rowStep) - 1; originY + row * rowStep < height + size; row++) {
    const y = originY + row * rowStep;
    for (let column = Math.floor(-originX / columnStep) - 1; ; column++) {
      const x = originX + column * columnStep + (row & 1 ? columnStep / 2 : 0);
      if (x > width + columnStep) break;
      const distance = Math.hypot(x - cx, y - cy) / reach;
      const level = bandAt(Math.floor(distance * 40), 40);
      const wave = rippleAt(distance * reach, ripple, size * 2) * fx.beat + rippleAt(distance * reach, dropRipple, size * 4) * fx.drop;
      const intensity = Math.min(1, level + wave);
      if (intensity < 0.04) continue;
      ctx.fillStyle = color(distance * 2 + intensity, 0.25 + intensity * 0.75);
      drawHexagon(x, y, size * (style.base + intensity * style.spread));
    }
  }
}
