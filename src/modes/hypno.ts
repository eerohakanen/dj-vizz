import { bandAt } from '../audio/spectrum';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { TAU } from '../math';
import { clock, fx, settings, signal, view } from '../state';

const ARMS = 10;
const STEPS = 34;
const RINGS = 6;
const BAND_WIDEN = 0.3;
const HUE_RATE = 0.05;

let huePhase = 0;

function drawArms(cx: number, cy: number, innerRadius: number, logSpan: number) {
  const { time, delta } = clock;
  const { punchBass, punchMid } = signal;
  huePhase += delta * HUE_RATE * settings.colorSpeed;
  const twist = (2.2 + Math.sin(time * 0.25) * 1.2 + punchMid * 1.5 + fx.drop * 2) * 0.35;
  const rotation = fx.spin * 2.5;
  for (let k = 0; k < ARMS; k++) {
    const start = (k / ARMS) * TAU + rotation;
    const armWidth = (TAU / ARMS) * (0.35 + Math.min(0.25, punchBass * 0.15) + bandAt(k, ARMS) * BAND_WIDEN);
    ctx.fillStyle = color((k / ARMS) * 2 + huePhase, 0.16 + punchBass * 0.1 + fx.beat * 0.08, 48);
    ctx.beginPath();
    for (let i = 0; i <= STEPS; i++) {
      const f = i / STEPS;
      const radius = innerRadius * Math.exp(logSpan * f);
      const angle = start + twist * logSpan * f;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    for (let i = STEPS; i >= 0; i--) {
      const f = i / STEPS;
      const radius = innerRadius * Math.exp(logSpan * f);
      const angle = start + armWidth + twist * logSpan * f + Math.sin(f * 8 - time * 3) * 0.08 * punchMid;
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    ctx.fill();
  }
}

function drawRings(cx: number, cy: number, outerRadius: number) {
  const { pixelRatio } = view;
  const { punchBass } = signal;
  for (let j = 0; j < RINGS; j++) {
    const f = (j / RINGS + fx.scroll * 0.12) % 1;
    ctx.strokeStyle = color(j * 0.3 + f, Math.min(1, 0.35 * (1 - f) * (0.4 + punchBass * 0.6 + fx.hat * 0.8 + fx.drop * 2)));
    ctx.lineWidth = (2 + punchBass * 10 + fx.drop * 12) * pixelRatio * (1 + f * 3);
    ctx.beginPath();
    ctx.arc(cx, cy, f * f * outerRadius, 0, TAU);
    ctx.stroke();
  }
}

export function drawHypno() {
  const { width, height, diagonal, pixelRatio } = view;
  const cx = width / 2;
  const cy = height / 2;
  const innerRadius = 4 * pixelRatio;
  const outerRadius = diagonal * 0.55;
  ctx.globalCompositeOperation = 'source-over';
  drawArms(cx, cy, innerRadius, Math.log(outerRadius / innerRadius));
  ctx.globalCompositeOperation = 'lighter';
  drawRings(cx, cy, outerRadius);
}
