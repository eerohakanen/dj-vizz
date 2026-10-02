import { bandAt } from '../audio/spectrum';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { approach, lerp, TAU } from '../math';
import { clock, fx, signal, view } from '../state';
import { glideStyle, nextVariant, STYLE_RATE } from './restyle';

const POINTS = 96;
const LAYERS = 5;
const STYLES = [
  { lobes: 3, ripple: 0.012, spacing: 0.07, thickness: 1 },
  { lobes: 5, ripple: 0.018, spacing: 0.055, thickness: 0.7 },
  { lobes: 2, ripple: 0.009, spacing: 0.085, thickness: 1.4 },
  { lobes: 6, ripple: 0.015, spacing: 0.065, thickness: 1 },
];

let styleIndex = 0;
const style = { ...STYLES[0] };
let previousLobes = STYLES[0].lobes;
let lobeBlend = 1;

export function restyleBlob(strength: number) {
  previousLobes = STYLES[styleIndex].lobes;
  lobeBlend = 0;
  styleIndex = nextVariant(styleIndex, STYLES.length, strength);
}

function easeStyle() {
  const target = STYLES[styleIndex];
  glideStyle(style, target);
  style.lobes = target.lobes;
  lobeBlend = approach(lobeBlend, 1, STYLE_RATE, clock.delta);
}

export function drawBlob() {
  const { width, height, minSide, pixelRatio } = view;
  const { punchBass, punchMid } = signal;
  const cx = width / 2;
  const cy = height / 2;
  easeStyle();
  ctx.lineJoin = 'round';
  for (let k = LAYERS - 1; k >= 0; k--) {
    const baseRadius = minSide * (0.08 + k * style.spacing) * (1 + punchBass * 0.35 + fx.drop * (0.2 + k * 0.12));
    const direction = k % 2 ? 1 : -1;
    ctx.beginPath();
    for (let i = 0; i <= POINTS; i++) {
      const angle = (i / POINTS) * TAU;
      const level = bandAt(i < POINTS / 2 ? i : POINTS - i, POINTS / 2);
      const phase = clock.time * (1 + k * 0.4) * direction + fx.spin * direction;
      const ripple = lerp(Math.sin(angle * (previousLobes + k) + phase), Math.sin(angle * (style.lobes + k) + phase), lobeBlend);
      const radius = baseRadius + level * minSide * (0.06 + k * 0.03) + ripple * minSide * style.ripple * (1 + punchMid * 4 + fx.hat * 3);
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
    ctx.lineWidth = ((2 + punchBass * 6) * pixelRatio * style.thickness) / (1 + k * 0.3);
    ctx.stroke();
  }
}
