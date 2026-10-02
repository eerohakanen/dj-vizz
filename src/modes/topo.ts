import { color } from '../color';
import { clamp01, keepNewest, randomRange, smoothstep } from '../math';
import { clock, fx, settings, signal } from '../state';
import { createPlate } from './plate';
import { glideStyle, nextVariant } from './restyle';

const MAX_BUMPS = 10;
const VARIANTS = [
  { scale: 1, levels: 1, line: 1, flow: 1 },
  { scale: 0.6, levels: 1.6, line: 0.7, flow: -1 },
  { scale: 1.5, levels: 0.6, line: 1.3, flow: 1 },
  { scale: 0.8, levels: 2, line: 0.6, flow: 0.5 },
  { scale: 1.25, levels: 1.3, line: 0.85, flow: -0.6 },
];

interface Bump {
  x: number;
  y: number;
  born: number;
  strength: number;
}

const plate = createPlate(4);
const bumps: Bump[] = [];
let drift = 0;
let contour = 0;
let variant = 0;
const style = { ...VARIANTS[0] };

export function bumpTopo() {
  bumps.push({ x: Math.random(), y: Math.random(), born: clock.time, strength: 0.6 + signal.punchBass });
  keepNewest(bumps, MAX_BUMPS);
}

export function quakeTopo() {
  for (let i = 0; i < 4; i++) bumps.push({ x: randomRange(0.2, 0.8), y: randomRange(0.2, 0.8), born: clock.time, strength: 2 });
  keepNewest(bumps, MAX_BUMPS);
}

export function restyleTopo(strength: number) {
  variant = nextVariant(variant, VARIANTS.length, strength);
}

function terrain(x: number, y: number, t: number) {
  return (
    Math.sin(x * 3.1 + t) * Math.cos(y * 2.7 - t * 0.6) +
    Math.sin((x * 0.8 - y * 1.3) * 4.3 + t * 0.4) * 0.5 +
    Math.cos((x + y) * 7.9 - t * 0.9) * 0.22
  );
}

export function drawTopo() {
  const { columns, rows } = plate.fit();
  glideStyle(style, VARIANTS[variant]);
  drift += clock.delta * settings.motion * (0.08 + signal.gate * (signal.energy * 0.5 + fx.drop)) * style.flow;
  contour += clock.delta * settings.motion * (0.05 + signal.punchMid * 0.6 + fx.kick * 0.8);
  const levels = (7 + signal.energy * 8 + fx.drop * 6) * style.levels;
  const line = (0.06 + signal.punchBass * 0.14 + fx.kick * 0.1) * style.line;
  const gain = 0.35 + signal.gate * 0.45 + fx.beat * 0.35;
  const aspect = columns / rows;
  const live = bumps.map((bump) => ({ ...bump, age: clock.time - bump.born }));
  for (let row = 0; row < rows; row++) {
    const v = row / rows;
    const terrainV = (v - 0.5) * style.scale + 0.5;
    for (let column = 0; column < columns; column++) {
      const u = column / columns;
      let height = terrain(((u - 0.5) * style.scale + 0.5) * aspect, terrainV, drift);
      for (const bump of live) {
        const dx = (u - bump.x) * aspect;
        const dy = v - bump.y;
        height += bump.strength * Math.exp(-(dx * dx + dy * dy) * 30) * Math.exp(-bump.age * 1.2);
      }
      const band = height * levels + contour;
      const edge = Math.abs(band - Math.round(band));
      plate.set(row * columns + column, clamp01(smoothstep(clamp01(1 - edge / line)) * gain + clamp01(height) * signal.mid * 0.15));
    }
  }
  plate.present(color(drift * 0.1, 1), color(0.6 + fx.beat * 0.2, 1, 60 + fx.kick * 20));
}
