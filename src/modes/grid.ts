import { bandAt } from '../audio/spectrum';
import { BACKGROUND, gradientCache, sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { TAU } from '../math';
import { fx, signal, view } from '../state';
import { glideStyle, nextVariant } from './restyle';

const sunGradient = gradientCache(() => ctx.createLinearGradient(0, -1, 0, 1));
const STYLES = [
  { horizon: 0.55, fan: 0.14, sun: 1, ridge: 0.4 },
  { horizon: 0.48, fan: 0.2, sun: 0.85, ridge: 0.3 },
  { horizon: 0.62, fan: 0.09, sun: 1.15, ridge: 0.5 },
  { horizon: 0.52, fan: 0.11, sun: 1.25, ridge: 0.25 },
];

let styleIndex = 0;
const style = { ...STYLES[0] };

export function restyleGrid(strength: number) {
  styleIndex = nextVariant(styleIndex, STYLES.length, strength);
}

function drawSun(horizon: number) {
  const { width, minSide } = view;
  const { punchBass } = signal;
  const radius = minSide * (0.24 + 0.05 * Math.min(1, punchBass) + 0.06 * fx.drop) * style.sun;
  const centerY = horizon - radius * 0.55;
  ctx.save();
  ctx.fillStyle = sunGradient(color(1.3, 1, 62), color(0, 1, 52));
  ctx.translate(width / 2, centerY);
  ctx.scale(radius, radius);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = BACKGROUND;
  for (let k = 0; k < 7; k++) {
    const y = centerY + radius * (0.05 + k * 0.15);
    const stripe = (k + 1) * radius * 0.02 * (1 + punchBass);
    ctx.fillRect(width / 2 - radius, y, radius * 2, stripe);
  }
}

function drawMountains(horizon: number) {
  const { width, height, pixelRatio } = view;
  const count = Math.floor(width / pixelRatio / 8);
  const step = width / count;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let i = 0; i <= count; i++) {
    const edge = Math.abs(i / count - 0.5) * 2;
    const level = bandAt(Math.floor((edge * count) / 2), count / 2);
    ctx.lineTo(i * step, horizon - level * height * style.ridge * (0.35 + edge));
  }
  ctx.lineTo(width, horizon);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8,4,20,.92)';
  ctx.fill();
  ctx.strokeStyle = color(2, 1, 58 + 25 * fx.hat);
  ctx.lineWidth = (2 + fx.hat * 2) * pixelRatio;
  ctx.stroke();
}

function drawFloor(horizon: number) {
  const { width, height, pixelRatio } = view;
  ctx.strokeStyle = color(2, 0.85, 58 + 25 * fx.drop);
  ctx.lineWidth = (1.5 + fx.beat * 2 + fx.drop * 3) * pixelRatio;
  const offset = fx.scroll % 1;
  ctx.beginPath();
  for (let k = 0; k < 16; k++) {
    const depth = (k + offset) / 16;
    const y = horizon + depth * depth * (height - horizon);
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.beginPath();
  for (let i = -14; i <= 14; i++) {
    ctx.moveTo(width / 2 + i * width * 0.012, horizon);
    ctx.lineTo(width / 2 + i * width * style.fan, height);
  }
  ctx.stroke();
}

export function drawGrid() {
  const { width, height } = view;
  glideStyle(style, STYLES[styleIndex]);
  const horizon = height * style.horizon;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, horizon);
  ctx.clip();
  drawSun(horizon);
  drawMountains(horizon);
  ctx.restore();
  drawFloor(horizon);
  ctx.fillStyle = color(1, 0.25 * fx.beat);
  ctx.fillRect(0, 0, width, height);
}
