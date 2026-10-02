import { audio } from '../audio/input';
import { bandAt } from '../audio/spectrum';
import { findTrigger } from '../audio/trigger';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { clock, fx, intensity, settings, signal, view } from '../state';
import { glideStyle, nextVariant } from './restyle';

const TRACES = [
  { amplitude: 1, direction: 1, lineWidth: 3 },
  { amplitude: 0.6, direction: -1, lineWidth: 2 },
  { amplitude: 0.3, direction: 1, lineWidth: 1 },
];
const EDGE_BARS = 24;
const STYLES = [
  { spread: 0, wobble: 0.03, edge: 0.22, thickness: 1 },
  { spread: 0.16, wobble: 0.015, edge: 0.12, thickness: 0.7 },
  { spread: 0, wobble: 0.07, edge: 0.3, thickness: 1.4 },
  { spread: -0.1, wobble: 0.04, edge: 0.17, thickness: 1 },
];

let styleIndex = 0;
const style = { ...STYLES[0] };

export function restyleScope(strength: number) {
  styleIndex = nextVariant(styleIndex, STYLES.length, strength);
}

export function drawScope() {
  const { width, height, pixelRatio } = view;
  const { waveform } = audio;
  const start = findTrigger(waveform);
  const span = waveform.length >> 1;
  const scale = height * 0.45 * signal.gainFactor * signal.gate * intensity() * 0.7 * (1 + fx.drop);
  glideStyle(style, STYLES[styleIndex]);
  ctx.lineJoin = 'round';
  TRACES.forEach(({ amplitude, direction, lineWidth }, k) => {
    ctx.strokeStyle = color(k * 0.8, 0.9 - k * 0.2);
    ctx.lineWidth = (lineWidth * style.thickness + fx.beat * 3) * pixelRatio * 1.5;
    const center = height / 2 + (k - 1) * style.spread * height;
    ctx.beginPath();
    for (let i = 0; i < span; i += 4) {
      const x = (i / span) * width;
      const wobble = Math.sin(i * 0.01 + clock.time * 3 + k) * height * style.wobble * signal.punchHigh;
      const y = center + ((waveform[start + i] - 128) / 128) * scale * amplitude * direction + wobble;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  });
  const slot = width / EDGE_BARS;
  for (let i = 0; i < EDGE_BARS; i++) {
    const barHeight = bandAt(i, EDGE_BARS) * height * (style.edge + fx.drop * 0.15);
    ctx.fillStyle = color(i / 12, Math.min(1, 0.55 + fx.hat * 0.45));
    ctx.fillRect(i * slot + 4, 0, slot - 8, barHeight);
    ctx.fillRect(i * slot + 4, height - barHeight, slot - 8, barHeight);
  }
}
