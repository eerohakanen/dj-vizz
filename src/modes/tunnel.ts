import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { frameScale, TAU } from '../math';
import { clock, fx, signal, view } from '../state';

const SIDE_COUNTS = [4, 5, 6, 8];

const rings: { radius: number; alpha: number }[] = [];

export function resetRings() {
  rings.length = 0;
}

export function spawnRing() {
  rings.push({ radius: 0, alpha: 1 });
}

export function drawTunnel() {
  const { width, height, diagonal, pixelRatio } = view;
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = diagonal / 2;
  const sides = SIDE_COUNTS[Math.floor(fx.scroll / 8) % SIDE_COUNTS.length];
  const step = frameScale(clock.delta);
  if (signal.gate < 0.02) resetRings();
  else if (Math.random() < 1 - Math.pow(1 - signal.gate * (0.04 + signal.punchMid * 0.3), step)) spawnRing();
  let alive = 0;
  for (const ring of rings) {
    if (ring.alpha <= 0.02) continue;
    rings[alive++] = ring;
    ring.radius += (1 + signal.punchBass * 20 + fx.drop * 30) * pixelRatio * (1 + (ring.radius / maxRadius) * 2) * step;
    const depth = ring.radius / maxRadius;
    ring.alpha = 1 - depth;
    ctx.strokeStyle = color(depth * 2, ring.alpha);
    ctx.lineWidth = (1 + depth * 10 + fx.beat * 4) * pixelRatio;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * TAU + fx.spin * 2 + depth;
      const x = cx + Math.cos(angle) * ring.radius;
      const y = cy + Math.sin(angle) * ring.radius;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  rings.length = alive;
  ctx.fillStyle = color(1, 0.35 + 0.5 * fx.beat);
  ctx.beginPath();
  ctx.arc(cx, cy, (12 + signal.punchBass * 80) * pixelRatio, 0, TAU);
  ctx.fill();
}
