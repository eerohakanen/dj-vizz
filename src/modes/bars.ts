import { bandAt } from '../audio/spectrum';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { lerp, updatePeak } from '../math';
import { clock, fx, signal, view } from '../state';
import { glideStyle, nextVariant } from './restyle';

const PEAK_FALL = 0.55;
const STYLES = [
  { fill: 0.76, anchor: 0, reach: 0.85 },
  { fill: 0.45, anchor: 1, reach: 0.8 },
  { fill: 0.92, anchor: 0, reach: 0.6 },
  { fill: 0.6, anchor: 1, reach: 0.95 },
];

let peaks = new Float32Array(0);
let styleIndex = 0;
const style = { ...STYLES[0] };

export function restyleBars(strength: number) {
  styleIndex = nextVariant(styleIndex, STYLES.length, strength);
}

export function dropBars() {
  peaks.fill(1);
}

export function drawBars() {
  const { width, height, pixelRatio } = view;
  const count = Math.max(40, Math.floor(width / pixelRatio / 14)) & ~1;
  const half = count / 2;
  const slot = width / count;
  glideStyle(style, STYLES[styleIndex]);
  const barWidth = slot * style.fill;
  if (peaks.length !== count) peaks = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const level = bandAt(i < half ? half - 1 - i : i - half, half);
    peaks[i] = updatePeak(peaks[i], level, PEAK_FALL, clock.delta);
    const barHeight = Math.min(height * 0.95, level * height * style.reach) + 2 * signal.gate;
    const peakHeight = Math.min(height * 0.95, peaks[i] * height * style.reach) + 2 * signal.gate;
    const x = i * slot + (slot - barWidth) / 2;
    const position = (i / count) * 2;
    const barTop = lerp(height - barHeight, (height - barHeight) / 2, style.anchor);
    const peakTop = lerp(height - peakHeight, (height - peakHeight) / 2, style.anchor);
    ctx.fillStyle = color(position, 0.9);
    ctx.fillRect(x, barTop, barWidth, barHeight);
    ctx.fillStyle = color(position + 0.5, 0.8 + 0.2 * fx.hat, 78 + 17 * fx.hat);
    ctx.fillRect(x, peakTop - 5 * pixelRatio, barWidth, (3 + fx.hat * 3) * pixelRatio);
    ctx.fillStyle = color(position, 0.18);
    ctx.fillRect(x, 0, barWidth, barHeight * 0.35);
  }
  ctx.fillStyle = color(1, 0.25 * fx.beat);
  ctx.fillRect(0, 0, width, height);
}
