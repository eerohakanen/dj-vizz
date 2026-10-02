import { bandAt } from '../audio/spectrum';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { approach, frameScale, lerp, TAU } from '../math';
import { clock, fx, settings, signal, view } from '../state';
import { glideStyle, nextVariant, STYLE_RATE } from './restyle';

const stars = Array.from({ length: 900 }, () => {
  const radius = Math.random();
  const depth = Math.random();
  return {
    angle: Math.random() * TAU,
    radius,
    depth,
    colorBand: Math.min(11, (((radius * 2 + depth) / 3) * 12) | 0),
  };
}).sort((a, b) => a.colorBand - b.colorBand);

const STYLES = [
  { arms: 2, twist: 3, depth: 0.15, orbit: 0.6 },
  { arms: 3, twist: 5, depth: 0.22, orbit: 0.45 },
  { arms: 4, twist: 1.5, depth: 0.1, orbit: 0.8 },
  { arms: 5, twist: 4, depth: 0.2, orbit: 0.5 },
];

let styleIndex = 0;
const style = { ...STYLES[0] };
let previousArms = STYLES[0].arms;
let armBlend = 1;

export function restyleGalaxy(strength: number) {
  previousArms = STYLES[styleIndex].arms;
  armBlend = 0;
  styleIndex = nextVariant(styleIndex, STYLES.length, strength);
}

function easeStyle() {
  const target = STYLES[styleIndex];
  glideStyle(style, target);
  style.arms = target.arms;
  armBlend = approach(armBlend, 1, STYLE_RATE, clock.delta);
}

export function drawGalaxy() {
  const { width, height, minSide, pixelRatio } = view;
  const { gate, punchBass } = signal;
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = minSide * 0.48;
  const step = frameScale(clock.delta);
  let activeBand = -1;
  easeStyle();
  for (const star of stars) {
    const level = bandAt(star.radius, 1);
    const orbit = star.depth > 0.5 ? style.orbit : -style.orbit;
    star.angle += (0.002 + 0.01 * (1 - star.radius) + punchBass * 0.03) * orbit * gate * (1 + fx.drop * 6) * settings.motion * step;
    const radius = star.radius * maxRadius * (1 + punchBass * 0.35 + fx.drop * (0.3 + star.depth * 0.6)) + level * maxRadius * 0.22;
    const phase = star.radius * 8 + fx.spin * 3;
    const arm = 1 + lerp(Math.sin(star.angle * previousArms + phase), Math.sin(star.angle * style.arms + phase), armBlend) * style.depth;
    const angle = star.angle + star.radius * style.twist;
    if (star.colorBand !== activeBand) {
      activeBand = star.colorBand;
      ctx.fillStyle = color(activeBand / 4);
    }
    ctx.globalAlpha = Math.min(1, 0.35 + level * 0.65);
    const size = (1 + level * 5 + fx.beat * 3 + fx.hat * star.radius * 4) * pixelRatio;
    ctx.fillRect(cx + Math.cos(angle) * radius * arm, cy + Math.sin(angle) * radius * arm, size, size);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = color(0, 0.55);
  ctx.beginPath();
  ctx.arc(cx, cy, (10 + punchBass * 70) * pixelRatio, 0, TAU);
  ctx.fill();
}
