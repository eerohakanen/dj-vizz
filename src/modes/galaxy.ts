import { bandAt } from '../audio/spectrum';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { frameScale, TAU } from '../math';
import { clock, fx, settings, signal, view } from '../state';

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

export function drawGalaxy() {
  const { width, height, minSide, pixelRatio } = view;
  const { gate, punchBass } = signal;
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = minSide * 0.48;
  const step = frameScale(clock.delta);
  let activeBand = -1;
  for (const star of stars) {
    const level = bandAt(star.radius, 1);
    const orbit = star.depth > 0.5 ? 0.6 : -0.6;
    star.angle += (0.002 + 0.01 * (1 - star.radius) + punchBass * 0.03) * orbit * gate * (1 + fx.drop * 6) * settings.motion * step;
    const radius = star.radius * maxRadius * (1 + punchBass * 0.35) + level * maxRadius * 0.22;
    const arm = 1 + Math.sin(star.angle * 2 + star.radius * 8 + fx.spin * 3) * 0.15;
    const angle = star.angle + star.radius * 3;
    if (star.colorBand !== activeBand) {
      activeBand = star.colorBand;
      ctx.fillStyle = color(activeBand / 4);
    }
    ctx.globalAlpha = Math.min(1, 0.35 + level * 0.65);
    const size = (1 + level * 5 + fx.beat * 3) * pixelRatio;
    ctx.fillRect(cx + Math.cos(angle) * radius * arm, cy + Math.sin(angle) * radius * arm, size, size);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = color(0, 0.55);
  ctx.beginPath();
  ctx.arc(cx, cy, (10 + punchBass * 70) * pixelRatio, 0, TAU);
  ctx.fill();
}
