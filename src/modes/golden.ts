import { bandAt } from '../audio/spectrum';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { approach, clamp01, TAU } from '../math';
import { clock, fx, settings, signal, view } from '../state';
import { glideStyle, nextVariant } from './restyle';

const DOT_COUNT = 700;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TWISTS = [0, 0.004, -0.006, 0.011, -0.013, 0.02];
const VARIANTS = [
  { count: DOT_COUNT, exponent: 0.5, size: 1, spin: 1 },
  { count: 420, exponent: 0.5, size: 1.5, spin: -1 },
  { count: DOT_COUNT, exponent: 0.65, size: 0.8, spin: 1.6 },
  { count: 560, exponent: 0.4, size: 1.2, spin: -0.6 },
  { count: 480, exponent: 0.58, size: 1.3, spin: 0.5 },
];

let twist = 0;
let twistTarget = 0;
let turn = 0;
let variant = 0;
const style = { ...VARIANTS[0] };

export function twistGolden() {
  twistTarget = TWISTS[(Math.random() * TWISTS.length) | 0] * (signal.downbeat ? 1 : 0.5);
}

export function bloomGolden() {
  twistTarget = TWISTS[TWISTS.length - 1] * (Math.random() < 0.5 ? -1 : 1);
}

export function restyleGolden(strength: number) {
  variant = nextVariant(variant, VARIANTS.length, strength);
}

export function drawGolden() {
  const { width, height, minSide, pixelRatio } = view;
  glideStyle(style, VARIANTS[variant]);
  twist = approach(twist, twistTarget, 3 * settings.motion, clock.delta);
  turn += clock.delta * settings.motion * (0.1 + signal.gate * (signal.energy * 0.8 + fx.drop * 2)) * style.spin;
  const outer = (minSide / 2) * (0.92 + fx.kick * 0.18 + fx.drop * 0.25);
  const cx = width / 2;
  const cy = height / 2;
  const visible = Math.min(DOT_COUNT, Math.ceil(style.count));
  for (let i = 1; i < visible; i++) {
    const ratio = i / style.count;
    const level = bandAt(Math.floor(ratio * 64), 64);
    const angle = i * (GOLDEN_ANGLE + twist) + turn + fx.spin;
    const radius = outer * Math.pow(ratio, style.exponent) * (1 + level * 0.12);
    const size = pixelRatio * (1.2 + level * 7 + fx.beat * 2) * (0.6 + ratio * 0.8) * style.size;
    ctx.fillStyle = color(ratio * 1.5 + level * 0.4, (0.35 + level * 0.65 + fx.hat * 0.2) * clamp01(style.count - i));
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, size, 0, TAU);
    ctx.fill();
  }
}
