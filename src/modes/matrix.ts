import { bandAt } from '../audio/spectrum';
import { createGlyphSheet, DENSITY_RAMP, RAIN_GLYPHS } from '../ascii';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { approach, clamp01, randomRange, signedRandom } from '../math';
import { clock, fx, settings, signal, view } from '../state';
import { glideStyle, nextVariant, STYLE_RATE } from './restyle';

const CELL = 16;
const MIN_TRAIL = 6;
const MAX_TRAIL = 26;
const BURST_SHARE = 0.3;
const MUTATE_SHARE = 0.03;
const GLYPH_SETS = [RAIN_GLYPHS, '01', '0123456789ABCDEF', DENSITY_RAMP.trim()];
const DENSITY_SOFTNESS = 0.15;
const FULL_DENSITY = 1 + DENSITY_SOFTNESS;
const MIN_DENSITY = 0.45;
const SPEED_RANGE = 0.9;
const TRAIL_RANGE = 0.9;
const MIGRATE_END = 1.05;
const GLYPH_SPREAD = 0.618034;
const DENSITY_SPREAD = 0.754878;

interface Drop {
  head: number;
  speed: number;
  trail: number;
}

const glyphSets = GLYPH_SETS.map((glyphs) => ({ trail: createGlyphSheet(glyphs), head: createGlyphSheet(glyphs) }));
const style = { fromSet: 0, toSet: 0, migrate: MIGRATE_END, density: FULL_DENSITY, speed: 1, trail: 1 };
const target = { density: FULL_DENSITY, speed: 1, trail: 1 };
let drops: Drop[] = [];
let seeds = new Uint8Array(0);
let rowCount = 0;

const freshDrop = (rows: number, scattered: boolean): Drop => ({
  head: scattered ? Math.random() * rows : -Math.random() * rows * 0.5,
  speed: randomRange(6, 14),
  trail: randomRange(MIN_TRAIL, MAX_TRAIL),
});

function layout(columns: number, rows: number) {
  if (drops.length === columns && rowCount === rows) return;
  drops = Array.from({ length: columns }, () => freshDrop(rows, true));
  rowCount = rows;
  seeds = new Uint8Array(columns * rows).map(() => (Math.random() * 256) | 0);
}

function burst(share: number) {
  for (const drop of drops) {
    if (Math.random() > share) continue;
    drop.head = 0;
    drop.speed = randomRange(22, 40);
    drop.trail = randomRange(MIN_TRAIL, MAX_TRAIL) * (1 + signal.energy);
  }
}

export const burstMatrix = () => burst(BURST_SHARE * (0.5 + signal.punchBass));

export const floodMatrix = () => burst(1);

const rank = (column: number, spread: number) => (column * spread) % 1;

export function restyleMatrix(strength: number) {
  const reach = Math.min(1, 0.4 + strength);
  style.fromSet = style.toSet;
  style.toSet = nextVariant(style.toSet, GLYPH_SETS.length, strength);
  style.migrate = 0;
  target.density = FULL_DENSITY - Math.random() * (FULL_DENSITY - MIN_DENSITY) * reach;
  target.speed = 1 + signedRandom(SPEED_RANGE) * reach;
  target.trail = 1 + signedRandom(TRAIL_RANGE) * reach;
}

function easeStyle() {
  style.migrate = approach(style.migrate, MIGRATE_END, STYLE_RATE, clock.delta);
  glideStyle(style, target);
}

function mutate() {
  const changes = Math.ceil(seeds.length * MUTATE_SHARE * (0.3 + fx.hat));
  for (let i = 0; i < changes; i++) seeds[(Math.random() * seeds.length) | 0] = (Math.random() * 256) | 0;
}

export function drawMatrix() {
  const { width, height, pixelRatio } = view;
  const cell = Math.max(8, Math.round(CELL * pixelRatio));
  const columns = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  layout(columns, rows);
  mutate();
  easeStyle();
  const pace = (0.25 + signal.gate * (signal.energy * 2 + signal.punchBass * 1.5 + fx.kick * 2 + fx.drop * 4)) * settings.motion * clock.delta * style.speed;
  const trailColor = color(0.25 + fx.beat * 0.15, 1, 45 + fx.kick * 20);
  const headColor = color(0.25, 1, 80 + fx.hat * 15);
  const painted = (index: number) => ({ trail: glyphSets[index].trail.paint(cell, trailColor), head: glyphSets[index].head.paint(cell, headColor), count: glyphSets[index].trail.count });
  const incoming = painted(style.toSet);
  const outgoing = style.fromSet === style.toSet || style.migrate >= MIGRATE_END - 0.001 ? incoming : painted(style.fromSet);
  for (let column = 0; column < columns; column++) {
    const drop = drops[column];
    drop.head += drop.speed * pace;
    const trail = drop.trail * style.trail;
    if (drop.head - trail > rows) Object.assign(drop, freshDrop(rows, false));
    const presence = clamp01((style.density - rank(column, DENSITY_SPREAD)) / DENSITY_SOFTNESS);
    if (presence <= 0) continue;
    const { trail: trailSheet, head: headSheet, count } = rank(column, GLYPH_SPREAD) < style.migrate ? incoming : outgoing;
    const level = bandAt(Math.abs(column - columns / 2) * 2, columns + 1);
    const x = column * cell;
    const head = Math.floor(drop.head);
    for (let k = 0; k < trail; k++) {
      const row = head - k;
      if (row < 0) break;
      if (row >= rows) continue;
      const glyph = seeds[row * columns + column] % count;
      ctx.globalAlpha = presence * (k === 0 ? 1 : Math.min(1, (1 - k / trail) * (0.2 + level * 1.6 + fx.beat * 0.3)));
      ctx.drawImage(k === 0 ? headSheet : trailSheet, glyph * cell, 0, cell, cell, x, row * cell, cell, cell);
    }
  }
  ctx.globalAlpha = 1;
}
