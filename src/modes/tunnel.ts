import { bandAt } from '../audio/spectrum';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { frameScale, lerp, TAU } from '../math';
import { clock, fx, settings, signal, view } from '../state';

const SIDE_COUNTS = [4, 5, 6, 8];
const SEGMENTS_PER_SIDE = 6;
const BAND_BULGE = 0.22;

const rings: { radius: number; alpha: number }[] = [];

function polygonPoint(sides: number, turn: number, spin: number) {
  const corner = Math.floor(turn * sides);
  const fraction = turn * sides - corner;
  const from = (corner / sides) * TAU + spin;
  const to = ((corner + 1) / sides) * TAU + spin;
  return {
    x: lerp(Math.cos(from), Math.cos(to), fraction),
    y: lerp(Math.sin(from), Math.sin(to), fraction),
  };
}

const mirroredBand = (turn: number) => bandAt(Math.abs(turn * 2 - 1), 1);

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
    ring.radius += (1 + signal.punchBass * 20 + fx.drop * 30) * pixelRatio * (1 + (ring.radius / maxRadius) * 2) * settings.motion * step;
    const depth = ring.radius / maxRadius;
    ring.alpha = 1 - depth;
    ctx.strokeStyle = color(depth * 2, ring.alpha);
    ctx.lineWidth = (1 + depth * 10 + fx.beat * 4) * pixelRatio;
    ctx.beginPath();
    const vertices = sides * SEGMENTS_PER_SIDE;
    const spin = fx.spin * 2 + depth;
    for (let i = 0; i <= vertices; i++) {
      const turn = i / vertices;
      const point = polygonPoint(sides, turn, spin);
      const reach = ring.radius * (1 + mirroredBand(turn) * BAND_BULGE);
      const x = cx + point.x * reach;
      const y = cy + point.y * reach;
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
