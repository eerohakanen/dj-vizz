import { sceneCtx as ctx } from '../canvas.js';
import { color } from '../color.js';
import { TAU } from '../math.js';
import { clock, fx, signal, view } from '../state.js';

const ARMS = 10;
const STEPS = 34;
const RINGS = 6;

function drawArms(cx, cy, innerRadius, logSpan) {
  const { time } = clock;
  const { punchBass, punchMid } = signal;
  const twist = (2.2 + Math.sin(time * 0.25) * 1.2 + punchMid * 1.5) * 0.35;
  const rotation = fx.spin * 2.5;
  const armWidth = (TAU / ARMS) * (0.35 + Math.min(0.25, punchBass * 0.15));
  for (let k = 0; k < ARMS; k++) {
    const start = (k / ARMS) * TAU + rotation;
    ctx.fillStyle = color((k / ARMS) * 2 + time * 0.05, 0.16 + punchBass * 0.1 + fx.beat * 0.08, 48);
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

function drawRings(cx, cy, outerRadius) {
  const { pixelRatio } = view;
  const { punchBass } = signal;
  for (let j = 0; j < RINGS; j++) {
    const f = (j / RINGS + fx.scroll * 0.12) % 1;
    ctx.strokeStyle = color(j * 0.3 + f, 0.35 * (1 - f) * (0.4 + punchBass * 0.6));
    ctx.lineWidth = (2 + punchBass * 10) * pixelRatio * (1 + f * 3);
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
