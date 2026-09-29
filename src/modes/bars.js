import { bandAt } from '../audio/spectrum.js';
import { sceneCtx as ctx } from '../canvas.js';
import { color } from '../color.js';
import { fx, signal, view } from '../state.js';

export function drawBars() {
  const { width, height, pixelRatio } = view;
  const count = Math.max(40, Math.floor(width / pixelRatio / 14)) & ~1;
  const half = count / 2;
  const slot = width / count;
  const barWidth = slot * 0.76;
  for (let i = 0; i < count; i++) {
    const level = bandAt(i < half ? half - 1 - i : i - half, half);
    const barHeight = Math.min(height * 0.95, level * height * 0.85) + 2 * signal.gate;
    const x = i * slot + slot * 0.12;
    const position = (i / count) * 2;
    ctx.fillStyle = color(position, 0.9);
    ctx.fillRect(x, height - barHeight, barWidth, barHeight);
    ctx.fillStyle = color(position + 0.5, 0.8, 78);
    ctx.fillRect(x, height - barHeight - 5 * pixelRatio, barWidth, 3 * pixelRatio);
    ctx.fillStyle = color(position, 0.18);
    ctx.fillRect(x, 0, barWidth, barHeight * 0.35);
  }
  ctx.fillStyle = color(1, 0.25 * fx.beat);
  ctx.fillRect(0, 0, width, height);
}
