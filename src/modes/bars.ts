import { bandAt } from '../audio/spectrum';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { updatePeak } from '../math';
import { clock, fx, signal, view } from '../state';

const PEAK_FALL = 0.55;

let peaks = new Float32Array(0);

export function dropBars() {
  peaks.fill(1);
}

export function drawBars() {
  const { width, height, pixelRatio } = view;
  const count = Math.max(40, Math.floor(width / pixelRatio / 14)) & ~1;
  const half = count / 2;
  const slot = width / count;
  const barWidth = slot * 0.76;
  if (peaks.length !== count) peaks = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const level = bandAt(i < half ? half - 1 - i : i - half, half);
    peaks[i] = updatePeak(peaks[i], level, PEAK_FALL, clock.delta);
    const barHeight = Math.min(height * 0.95, level * height * 0.85) + 2 * signal.gate;
    const peakHeight = Math.min(height * 0.95, peaks[i] * height * 0.85) + 2 * signal.gate;
    const x = i * slot + slot * 0.12;
    const position = (i / count) * 2;
    ctx.fillStyle = color(position, 0.9);
    ctx.fillRect(x, height - barHeight, barWidth, barHeight);
    ctx.fillStyle = color(position + 0.5, 0.8 + 0.2 * fx.hat, 78 + 17 * fx.hat);
    ctx.fillRect(x, height - peakHeight - 5 * pixelRatio, barWidth, (3 + fx.hat * 3) * pixelRatio);
    ctx.fillStyle = color(position, 0.18);
    ctx.fillRect(x, 0, barWidth, barHeight * 0.35);
  }
  ctx.fillStyle = color(1, 0.25 * fx.beat);
  ctx.fillRect(0, 0, width, height);
}
