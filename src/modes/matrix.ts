import { bandAt } from '../audio/spectrum';
import { createGlyphSheet, RAIN_GLYPHS } from '../ascii';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { randomRange } from '../math';
import { clock, fx, settings, signal, view } from '../state';

const CELL = 16;
const MIN_TRAIL = 6;
const MAX_TRAIL = 26;
const BURST_SHARE = 0.3;
const MUTATE_SHARE = 0.03;

interface Drop {
  head: number;
  speed: number;
  trail: number;
}

const trailGlyphs = createGlyphSheet(RAIN_GLYPHS);
const headGlyphs = createGlyphSheet(RAIN_GLYPHS);
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
  const pace = (0.25 + signal.gate * (signal.energy * 2 + signal.punchBass * 1.5 + fx.kick * 2 + fx.drop * 4)) * settings.motion * clock.delta;
  const trailSheet = trailGlyphs.paint(cell, color(0.25 + fx.beat * 0.15, 1, 45 + fx.kick * 20));
  const headSheet = headGlyphs.paint(cell, color(0.25, 1, 80 + fx.hat * 15));
  const count = trailGlyphs.count;
  for (let column = 0; column < columns; column++) {
    const drop = drops[column];
    drop.head += drop.speed * pace;
    if (drop.head - drop.trail > rows) Object.assign(drop, freshDrop(rows, false));
    const level = bandAt(Math.abs(column - columns / 2) * 2, columns + 1);
    const x = column * cell;
    const head = Math.floor(drop.head);
    for (let k = 0; k < drop.trail; k++) {
      const row = head - k;
      if (row < 0) break;
      if (row >= rows) continue;
      const glyph = seeds[row * columns + column] % count;
      ctx.globalAlpha = k === 0 ? 1 : Math.min(1, (1 - k / drop.trail) * (0.2 + level * 1.6 + fx.beat * 0.3));
      ctx.drawImage(k === 0 ? headSheet : trailSheet, glyph * cell, 0, cell, cell, x, row * cell, cell, cell);
    }
  }
  ctx.globalAlpha = 1;
}
