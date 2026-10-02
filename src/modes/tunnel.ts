import { bandAt } from '../audio/spectrum';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { approach, frameScale, keepNewest, lerp, randomRange, signedRandom, smoothstep, TAU } from '../math';
import { clock, fx, settings, signal, view } from '../state';
import { glideStyle, nextVariant, STYLE_RATE } from './restyle';

const SIDE_COUNTS = [4, 5, 6, 8];
const SEGMENTS_PER_SIDE = 6;
const BAND_BULGE = 0.22;
const MAX_RINGS = 18;
const MIN_MOTION = 0.02;
const VOLLEY_RINGS = 2;
const VOLLEY_SPACING = 90;
const SPAWN_BASE = 0.02;
const SPAWN_PUNCH = 0.15;
const TWIST_RANGE = 3;
const DENSITY_RANGE = 1.2;
const BULGE_RANGE = 0.18;

const point = { x: 0, y: 0 };
const morphPoint = { x: 0, y: 0 };

const rings: { radius: number; alpha: number }[] = [];

const style = { fromShift: 0, toShift: 0, morph: 1, twist: 1, density: 1, bulge: BAND_BULGE };
const target = { twist: 1, density: 1, bulge: BAND_BULGE };

function setPolygonPoint(sides: number, turn: number, spin: number, out: { x: number; y: number }) {
  const corner = Math.floor(turn * sides);
  const fraction = turn * sides - corner;
  const from = (corner / sides) * TAU + spin;
  const to = ((corner + 1) / sides) * TAU + spin;
  out.x = lerp(Math.cos(from), Math.cos(to), fraction);
  out.y = lerp(Math.sin(from), Math.sin(to), fraction);
}

const mirroredBand = (turn: number) => bandAt(Math.abs(turn * 2 - 1), 1);

const sidesAt = (shift: number) => SIDE_COUNTS[(Math.floor(fx.scroll / 8) + shift) % SIDE_COUNTS.length];

export function resetRings() {
  rings.length = 0;
}

export function spawnRing(radius = 0) {
  rings.push({ radius, alpha: 1 });
}

export function spawnRingVolley() {
  const { pixelRatio } = view;
  for (let k = 0; k < VOLLEY_RINGS; k++) spawnRing(k * VOLLEY_SPACING * pixelRatio);
}

export function restyleTunnel(strength: number) {
  const reach = Math.min(1, 0.4 + strength);
  style.fromShift = style.toShift;
  style.toShift = nextVariant(style.toShift, SIDE_COUNTS.length, strength);
  style.morph = 0;
  target.twist = 1 + signedRandom(TWIST_RANGE * 2) * reach;
  target.density = 1 + signedRandom(DENSITY_RANGE) * reach;
  target.bulge = BAND_BULGE + randomRange(-BULGE_RANGE, BULGE_RANGE) * reach;
}

function easeStyle() {
  style.morph = approach(style.morph, 1, STYLE_RATE, clock.delta);
  glideStyle(style, target);
}

export function drawTunnel() {
  const { width, height, diagonal, pixelRatio } = view;
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = diagonal / 2;
  easeStyle();
  const fromSides = sidesAt(style.fromShift);
  const sides = sidesAt(style.toShift);
  const morphing = fromSides !== sides && style.morph < 0.999;
  const blend = smoothstep(style.morph);
  const step = frameScale(clock.delta);
  if (signal.gate < 0.02) resetRings();
  else if (settings.motion > MIN_MOTION && Math.random() < 1 - Math.pow(1 - signal.gate * (SPAWN_BASE + signal.punchMid * SPAWN_PUNCH) * style.density, step)) spawnRing();
  let alive = 0;
  for (const ring of rings) {
    if (ring.alpha <= 0.02) continue;
    rings[alive++] = ring;
    ring.radius += (1 + signal.punchBass * 20 + fx.drop * 30) * pixelRatio * (1 + (ring.radius / maxRadius) * 2) * settings.motion * step;
    const depth = ring.radius / maxRadius;
    ring.alpha = 1 - depth;
    ctx.strokeStyle = color(depth * 2, ring.alpha);
    ctx.lineWidth = (1 + depth * 10 + fx.beat * 4 + fx.hat * 3 * (1 - depth)) * pixelRatio;
    ctx.beginPath();
    const vertices = (morphing ? Math.max(fromSides, sides) : sides) * SEGMENTS_PER_SIDE;
    const spin = fx.spin * 2 + depth * style.twist;
    for (let i = 0; i <= vertices; i++) {
      const turn = i / vertices;
      setPolygonPoint(sides, turn, spin, point);
      if (morphing) {
        setPolygonPoint(fromSides, turn, spin, morphPoint);
        point.x = lerp(morphPoint.x, point.x, blend);
        point.y = lerp(morphPoint.y, point.y, blend);
      }
      const reach = ring.radius * (1 + mirroredBand(turn) * style.bulge);
      const x = cx + point.x * reach;
      const y = cy + point.y * reach;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  rings.length = alive;
  keepNewest(rings, MAX_RINGS);
  ctx.fillStyle = color(1, 0.35 + 0.5 * fx.beat);
  ctx.beginPath();
  ctx.arc(cx, cy, (12 + signal.punchBass * 80) * pixelRatio, 0, TAU);
  ctx.fill();
}
