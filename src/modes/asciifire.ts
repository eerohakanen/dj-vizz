import { bandAt } from '../audio/spectrum';
import { createGlyphSheet, DENSITY_RAMP, drawGlyphField, glyphGrid } from '../ascii';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { clamp01, frameScale, lerp } from '../math';
import { fx, clock, settings, signal } from '../state';
import { glideStyle, nextVariant } from './restyle';

const CELL = 12;
const MAX_STEPS = 3;
const VARIANTS = [
  { cooling: 1, wind: 1, sway: 1.3, edges: 0 },
  { cooling: 0.6, wind: 0.4, sway: 0.7, edges: 1 },
  { cooling: 1.5, wind: 2, sway: 2.1, edges: 0.5 },
  { cooling: 0.8, wind: 1.4, sway: 0.5, edges: 0 },
  { cooling: 1.2, wind: 0.2, sway: 1, edges: 1 },
];

const tones = [createGlyphSheet(DENSITY_RAMP), createGlyphSheet(DENSITY_RAMP), createGlyphSheet(DENSITY_RAMP), createGlyphSheet(DENSITY_RAMP)];
let heat = new Float32Array(0);
let pending = 0;
let flare = 0;
let windPhase = 0;
let variant = 0;
const style = { ...VARIANTS[0] };

export function flareAsciiFire() {
  flare = 1;
}

export function restyleAsciiFire(strength: number) {
  variant = nextVariant(variant, VARIANTS.length, strength);
}

function ignite(columns: number, rows: number) {
  const base = (rows - 1) * columns;
  for (let column = 0; column < columns; column++) {
    const offset = Math.abs(column - columns / 2) * 2;
    const level = lerp(bandAt(offset, columns + 1), bandAt(columns - offset, columns + 1), style.edges);
    const source = signal.gate * (level * 1.3 + signal.punchBass * 0.5 + fx.kick * 0.5) + flare + fx.drop;
    heat[base + column] = clamp01(source * (0.7 + Math.random() * 0.3));
  }
}

function rise(columns: number, rows: number) {
  const cooling = (0.035 - signal.energy * 0.022 - fx.drop * 0.01) * (1 - flare * 0.5) * style.cooling;
  const wind = Math.sin(windPhase) * (0.3 + fx.hat) * style.wind;
  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns; column++) {
      const below = (row + 1) * columns;
      const drift = Math.round(column + wind + (Math.random() - 0.5) * 2);
      const from = below + Math.min(columns - 1, Math.max(0, drift));
      heat[row * columns + column] = Math.max(0, heat[from] * 0.985 - Math.random() * cooling);
    }
  }
}

export function drawAsciiFire() {
  const { cell, columns, rows } = glyphGrid(CELL);
  if (heat.length !== columns * rows) heat = new Float32Array(columns * rows);
  glideStyle(style, VARIANTS[variant]);
  windPhase += clock.delta * style.sway;
  pending += frameScale(clock.delta) * settings.motion * (0.6 + signal.energy);
  const steps = Math.min(MAX_STEPS, Math.floor(pending));
  pending -= steps;
  for (let i = 0; i < steps; i++) {
    ignite(columns, rows);
    rise(columns, rows);
  }
  flare = Math.max(0, flare - clock.delta * 3);
  const sheets = tones.map((tone, index) => tone.paint(cell, color(index * 0.1, 1, 30 + index * 18 + fx.beat * 10)));
  drawGlyphField(ctx, heat, columns, rows, cell, sheets, tones[0].count);
}
