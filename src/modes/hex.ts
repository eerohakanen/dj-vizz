import { bandAt } from '../audio/spectrum';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { clock, fx, signal, view } from '../state';

const SIXTH_TURN = Math.PI / 3;
const TWELFTH_TURN = Math.PI / 6;

function drawHexagon(x: number, y: number, radius: number) {
  ctx.beginPath();
  for (let j = 0; j < 6; j++) {
    const angle = j * SIXTH_TURN + TWELFTH_TURN + fx.spin * 0.5;
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  ctx.fill();
}

export function drawHex() {
  const { width, height, pixelRatio } = view;
  const size = 58 * pixelRatio;
  const columnStep = size * Math.sqrt(3);
  const rowStep = size * 1.5;
  const cx = width / 2;
  const cy = height / 2;
  const reach = Math.hypot(cx, cy);
  const ripple = (clock.time - signal.lastBeat) * reach * 1.6;
  for (let row = -1; row * rowStep < height + size; row++) {
    const y = row * rowStep;
    for (let column = -1; ; column++) {
      const x = column * columnStep + (row & 1 ? columnStep / 2 : 0);
      if (x > width + columnStep) break;
      const distance = Math.hypot(x - cx, y - cy) / reach;
      const level = bandAt(Math.floor(distance * 40), 40);
      const wave = Math.max(0, 1 - Math.abs(distance * reach - ripple) / (size * 2)) * fx.beat;
      const intensity = Math.min(1, level + wave);
      if (intensity < 0.04) continue;
      ctx.fillStyle = color(distance * 2 + intensity, 0.25 + intensity * 0.75);
      drawHexagon(x, y, size * (0.15 + intensity * 0.8));
    }
  }
}
