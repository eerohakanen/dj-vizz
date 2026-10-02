import { bandAt } from '../audio/spectrum';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { approach, TAU } from '../math';
import { clock, fx, settings, signal, view } from '../state';

const DOT_COUNT = 700;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TWISTS = [0, 0.004, -0.006, 0.011, -0.013, 0.02];

let twist = 0;
let twistTarget = 0;
let turn = 0;

export function twistGolden() {
  twistTarget = TWISTS[(Math.random() * TWISTS.length) | 0] * (signal.downbeat ? 1 : 0.5);
}

export function bloomGolden() {
  twistTarget = TWISTS[TWISTS.length - 1] * (Math.random() < 0.5 ? -1 : 1);
}

export function drawGolden() {
  const { width, height, minSide, pixelRatio } = view;
  twist = approach(twist, twistTarget, 3 * settings.motion, clock.delta);
  turn += clock.delta * settings.motion * (0.1 + signal.gate * (signal.energy * 0.8 + fx.drop * 2));
  const spacing = (minSide / 2 / Math.sqrt(DOT_COUNT)) * (0.92 + fx.kick * 0.18 + fx.drop * 0.25);
  const cx = width / 2;
  const cy = height / 2;
  for (let i = 1; i < DOT_COUNT; i++) {
    const ratio = i / DOT_COUNT;
    const level = bandAt(Math.floor(ratio * 64), 64);
    const angle = i * (GOLDEN_ANGLE + twist) + turn + fx.spin;
    const radius = spacing * Math.sqrt(i) * (1 + level * 0.12);
    const size = pixelRatio * (1.2 + level * 7 + fx.beat * 2) * (0.6 + ratio * 0.8);
    ctx.fillStyle = color(ratio * 1.5 + level * 0.4, 0.35 + level * 0.65 + fx.hat * 0.2);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, size, 0, TAU);
    ctx.fill();
  }
}
