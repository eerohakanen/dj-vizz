import { bandAt } from '../audio/spectrum';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { TAU } from '../math';
import { fx, signal, view } from '../state';
import { glideStyle, nextVariant } from './restyle';

const SPOKES = 160;
const GROUPS = 16;
const QUARTER_TURN = Math.PI / 2;
const STYLES = [
  { core: 0.13, reach: 0.42, thickness: 1, twist: 0 },
  { core: 0.2, reach: 0.32, thickness: 0.6, twist: 0.9 },
  { core: 0.09, reach: 0.5, thickness: 1.6, twist: 0 },
  { core: 0.16, reach: 0.38, thickness: 1, twist: -1.1 },
];

let styleIndex = 0;
const style = { ...STYLES[0] };

export function restyleRadial(strength: number) {
  styleIndex = nextVariant(styleIndex, STYLES.length, strength);
}

const spokeLevel = (i: number) => bandAt(i < SPOKES / 2 ? i : SPOKES - 1 - i, SPOKES / 2);

export function drawRadial() {
  const { width, height, minSide, pixelRatio } = view;
  const cx = width / 2;
  const cy = height / 2;
  glideStyle(style, STYLES[styleIndex]);
  const base = minSide * (style.core + 0.08 * Math.min(1, signal.punchBass));
  const inner = base * 0.85;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, width / SPOKES / 3) * style.thickness;
  for (let group = 0; group < GROUPS; group++) {
    const from = (group * SPOKES) / GROUPS;
    const to = ((group + 1) * SPOKES) / GROUPS;

    ctx.strokeStyle = color((group / GROUPS) * 2);
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      const angle = (i / SPOKES) * TAU - QUARTER_TURN + fx.spin;
      const length = spokeLevel(i) * minSide * (style.reach + fx.drop * 0.3 + fx.hat * 0.08) + 3 * signal.gate;
      if (length < 2) continue;
      const tipAngle = angle + (style.twist * length) / minSide;
      ctx.moveTo(cx + Math.cos(angle) * base, cy + Math.sin(angle) * base);
      ctx.lineTo(cx + Math.cos(tipAngle) * (base + length), cy + Math.sin(tipAngle) * (base + length));
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
