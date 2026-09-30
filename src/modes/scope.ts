import { audio } from '../audio/input';
import { bandAt } from '../audio/spectrum';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { clock, fx, settings, signal, view } from '../state';

const TRACES = [
  { amplitude: 1, direction: 1, lineWidth: 3 },
  { amplitude: 0.6, direction: -1, lineWidth: 2 },
  { amplitude: 0.3, direction: 1, lineWidth: 1 },
];
const EDGE_BARS = 24;

export function drawScope() {
  const { width, height, pixelRatio } = view;
  const { waveform } = audio;
  const scale = height * 0.45 * signal.gainFactor * signal.gate * settings.reactivity * 0.7 * (1 + fx.drop);
  ctx.lineJoin = 'round';
  TRACES.forEach(({ amplitude, direction, lineWidth }, k) => {
    ctx.strokeStyle = color(k * 0.8, 0.9 - k * 0.2);
    ctx.lineWidth = (lineWidth + fx.beat * 3) * pixelRatio * 1.5;
    ctx.beginPath();
    for (let i = 0; i < waveform.length; i += 4) {
      const x = (i / waveform.length) * width;
      const wobble = Math.sin(i * 0.01 + clock.time * 3 + k) * height * 0.03 * signal.punchHigh;
      const y = height / 2 + ((waveform[i] - 128) / 128) * scale * amplitude * direction + wobble;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  });
  const slot = width / EDGE_BARS;
  for (let i = 0; i < EDGE_BARS; i++) {
    const barHeight = bandAt(i, EDGE_BARS) * height * 0.22;
    ctx.fillStyle = color(i / 12, 0.55);
    ctx.fillRect(i * slot + 4, 0, slot - 8, barHeight);
    ctx.fillRect(i * slot + 4, height - barHeight, slot - 8, barHeight);
  }
}
