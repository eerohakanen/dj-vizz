import { bandAt } from '../audio/spectrum';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { TAU } from '../math';
import { clock, fx, signal, view } from '../state';

const POINTS = 96;
const LAYERS = 5;

export function drawBlob() {
  const { width, height, minSide, pixelRatio } = view;
  const { punchBass, punchMid } = signal;
  const cx = width / 2;
  const cy = height / 2;
  ctx.lineJoin = 'round';
  for (let k = LAYERS - 1; k >= 0; k--) {
    const baseRadius = minSide * (0.08 + k * 0.07) * (1 + punchBass * 0.35 + fx.drop * (0.2 + k * 0.12));
    const direction = k % 2 ? 1 : -1;
    ctx.beginPath();
    for (let i = 0; i <= POINTS; i++) {
      const angle = (i / POINTS) * TAU;
      const level = bandAt(i < POINTS / 2 ? i : POINTS - i, POINTS / 2);
      const ripple = Math.sin(angle * (3 + k) + clock.time * (1 + k * 0.4) * direction + fx.spin * direction);
      const radius = baseRadius + level * minSide * (0.06 + k * 0.03) + ripple * minSide * 0.012 * (1 + punchMid * 4 + fx.hat * 3);
      const rotated = angle + fx.spin * direction * 0.3;
      const x = cx + Math.cos(rotated) * radius;
      const y = cy + Math.sin(rotated) * radius;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color(k * 0.45, 0.05 + 0.1 * fx.beat);
    ctx.fill();
    ctx.strokeStyle = color(k * 0.45, 0.9);
    ctx.lineWidth = ((2 + punchBass * 6) * pixelRatio) / (1 + k * 0.3);
    ctx.stroke();
  }
}
