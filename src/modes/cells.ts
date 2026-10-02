import { bandAt } from '../audio/spectrum';
import { color } from '../color';
import { clamp01, decay, randomRange, signedRandom, smoothstep } from '../math';
import { clock, fx, settings, signal } from '../state';
import { createPlate } from './plate';

const SEED_COUNT = 22;

interface Seed {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const plate = createPlate(5);
const seeds: Seed[] = Array.from({ length: SEED_COUNT }, () => ({ x: Math.random(), y: Math.random(), vx: signedRandom(0.04), vy: signedRandom(0.04) }));
const glow = new Float32Array(SEED_COUNT);

function kick(strength: number) {
  for (const seed of seeds) {
    const angle = Math.atan2(seed.y - 0.5, seed.x - 0.5) + signedRandom(1);
    seed.vx += Math.cos(angle) * strength * randomRange(0.5, 1);
    seed.vy += Math.sin(angle) * strength * randomRange(0.5, 1);
  }
}

export const kickCells = () => kick(0.12 + signal.punchBass * 0.15);

export const shatterCells = () => kick(0.6);

function moveSeeds() {
  const step = clock.delta * settings.motion * (0.4 + signal.gate * (signal.energy * 1.5 + fx.drop * 3));
  const friction = decay(0.4, clock.delta);
  for (const seed of seeds) {
    seed.x += seed.vx * step;
    seed.y += seed.vy * step;
    if (seed.x < 0 || seed.x > 1) seed.vx = -seed.vx;
    if (seed.y < 0 || seed.y > 1) seed.vy = -seed.vy;
    seed.x = clamp01(seed.x);
    seed.y = clamp01(seed.y);
    const speed = Math.hypot(seed.vx, seed.vy);
    if (speed > 0.05) {
      seed.vx *= friction;
      seed.vy *= friction;
    }
  }
}

export function drawCells() {
  const { columns, rows } = plate.fit();
  moveSeeds();
  for (let i = 0; i < SEED_COUNT; i++) glow[i] = bandAt(i, SEED_COUNT);
  const aspect = columns / rows;
  const border = 0.012 + signal.punchBass * 0.02 + fx.kick * 0.02;
  const fill = 0.15 + signal.mid * 0.5 + fx.snare * 0.3;
  const gain = 0.4 + signal.gate * 0.4 + fx.beat * 0.4;
  for (let row = 0; row < rows; row++) {
    const v = row / rows;
    for (let column = 0; column < columns; column++) {
      const u = column / columns;
      let nearest = Infinity;
      let second = Infinity;
      let owner = 0;
      for (let i = 0; i < SEED_COUNT; i++) {
        const dx = (u - seeds[i].x) * aspect;
        const dy = v - seeds[i].y;
        const distance = dx * dx + dy * dy;
        if (distance < nearest) {
          second = nearest;
          nearest = distance;
          owner = i;
        } else if (distance < second) second = distance;
      }
      const gap = Math.sqrt(second) - Math.sqrt(nearest);
      const edge = smoothstep(clamp01(1 - gap / border));
      const core = glow[owner] * fill * Math.max(0, 1 - Math.sqrt(nearest) * 6);
      plate.set(row * columns + column, clamp01((edge + core) * gain));
    }
  }
  plate.present(color(fx.beat * 0.3, 1), color(0.5 + signal.mid * 0.3, 1, 55 + fx.kick * 25));
}
