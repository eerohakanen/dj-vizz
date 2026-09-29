import { bandAt } from '../audio/spectrum.js';
import { sceneCtx as ctx } from '../canvas.js';
import { color } from '../color.js';
import { TAU } from '../math.js';
import { fx, signal, view } from '../state.js';

const SPOKES = 160;
const GROUPS = 16;
const QUARTER_TURN = Math.PI / 2;

const spokeLevel = (i) => bandAt(i < SPOKES / 2 ? i : SPOKES - 1 - i, SPOKES / 2);

export function drawRadial() {
  const { width, height, minSide, pixelRatio } = view;
  const cx = width / 2;
  const cy = height / 2;
  const base = minSide * (0.13 + 0.08 * Math.min(1, signal.punchBass));
  const inner = base * 0.85;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, width / SPOKES / 3);
  for (let group = 0; group < GROUPS; group++) {
    const from = (group * SPOKES) / GROUPS;
    const to = ((group + 1) * SPOKES) / GROUPS;

    ctx.strokeStyle = color((group / GROUPS) * 2);
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      const angle = (i / SPOKES) * TAU - QUARTER_TURN + fx.spin;
      const length = spokeLevel(i) * minSide * 0.42 + 3 * signal.gate;
      if (length < 2) continue;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      ctx.moveTo(cx + cos * base, cy + sin * base);
      ctx.lineTo(cx + cos * (base + length), cy + sin * (base + length));
    }
    ctx.stroke();

    ctx.strokeStyle = color((group / GROUPS) * 2 + 1, 0.6);
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      const angle = -((i / SPOKES) * TAU - QUARTER_TURN) + fx.spin;
      const length = spokeLevel(i) * base * 0.6;
      if (length < 1) continue;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      ctx.moveTo(cx + cos * inner, cy + sin * inner);
      ctx.lineTo(cx + cos * (inner - length), cy + sin * (inner - length));
    }
    ctx.stroke();
  }
  ctx.strokeStyle = color(0, 0.9);
  ctx.lineWidth = (3 + fx.beat * 6) * pixelRatio;
  ctx.beginPath();
  ctx.arc(cx, cy, base * (0.92 + 0.12 * fx.beat), 0, TAU);
  ctx.stroke();
  ctx.fillStyle = color(2, 0.12 + 0.4 * fx.beat);
  ctx.beginPath();
  ctx.arc(cx, cy, base * 0.9, 0, TAU);
  ctx.fill();
}
