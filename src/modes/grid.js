import { bandAt } from '../audio/spectrum.js';
import { BACKGROUND, sceneCtx as ctx } from '../canvas.js';
import { color } from '../color.js';
import { TAU } from '../math.js';
import { fx, signal, view } from '../state.js';

function drawSun(horizon) {
  const { width, minSide } = view;
  const { punchBass } = signal;
  const radius = minSide * (0.24 + 0.05 * Math.min(1, punchBass));
  const centerY = horizon - radius * 0.55;
  const gradient = ctx.createLinearGradient(0, centerY - radius, 0, centerY + radius);
  gradient.addColorStop(0, color(1.3, 1, 62));
  gradient.addColorStop(1, color(0, 1, 52));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(width / 2, centerY, radius, 0, TAU);
  ctx.fill();
  ctx.fillStyle = BACKGROUND;
  for (let k = 0; k < 7; k++) {
    const y = centerY + radius * (0.05 + k * 0.15);
    const stripe = (k + 1) * radius * 0.02 * (1 + punchBass);
    ctx.fillRect(width / 2 - radius, y, radius * 2, stripe);
  }
}

function drawMountains(horizon) {
  const { width, height, pixelRatio } = view;
  const count = Math.floor(width / pixelRatio / 8);
  const step = width / count;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let i = 0; i <= count; i++) {
    const edge = Math.abs(i / count - 0.5) * 2;
    const level = bandAt(Math.floor((edge * count) / 2), count / 2);
    ctx.lineTo(i * step, horizon - level * height * 0.4 * (0.35 + edge));
  }
  ctx.lineTo(width, horizon);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8,4,20,.92)';
  ctx.fill();
  ctx.strokeStyle = color(2, 1);
  ctx.lineWidth = 2 * pixelRatio;
  ctx.stroke();
}

function drawFloor(horizon) {
  const { width, height, pixelRatio } = view;
  ctx.strokeStyle = color(2, 0.85);
  ctx.lineWidth = (1.5 + fx.beat * 2) * pixelRatio;
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
    ctx.lineTo(width / 2 + i * width * 0.14, height);
  }
  ctx.stroke();
}

export function drawGrid() {
  const { width, height } = view;
  const horizon = height * 0.55;
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
