import { createGlyphSheet, DENSITY_RAMP, drawGlyphField, glyphGrid } from '../ascii';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { clamp01 } from '../math';
import { clock, fx, settings, signal } from '../state';

const CELL = 12;

const tones = [createGlyphSheet(DENSITY_RAMP), createGlyphSheet(DENSITY_RAMP), createGlyphSheet(DENSITY_RAMP), createGlyphSheet(DENSITY_RAMP)];
let field = new Float32Array(0);
let phase = 0;
let lastRipple = -9;

export function rippleAsciiPlasma() {
  lastRipple = clock.time;
}

export function drawAsciiPlasma() {
  const { cell, columns, rows } = glyphGrid(CELL);
  if (field.length !== columns * rows) field = new Float32Array(columns * rows);
  phase += clock.delta * settings.motion * (0.4 + signal.gate * (signal.energy * 2.5 + signal.punchBass * 1.5 + fx.drop * 4));
  const zoom = (0.12 - signal.bass * 0.04) / (1 + fx.kick * 0.25);
  const ripple = (clock.time - lastRipple) * 30;
  const ringFade = Math.max(0, 1 - (clock.time - lastRipple) * 1.5);
  const lift = 0.15 + signal.gate * 0.4 + fx.beat * 0.35;
  const cx = columns / 2;
  const cy = rows / 2;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = (column - cx) * zoom;
      const y = (row - cy) * zoom * 2;
      const distance = Math.hypot(column - cx, (row - cy) * 2);
      const wave =
        Math.sin(x + phase) +
        Math.sin(y * 1.3 - phase * 1.2) +
        Math.sin((x + y) * 0.7 + phase * 0.8) +
        Math.sin(distance * zoom * 1.5 - phase * 2);
      const ring = Math.max(0, 1 - Math.abs(distance - ripple) / 4) * ringFade;
      field[row * columns + column] = clamp01(((wave + 4) / 8) * lift + ring * 0.8 + signal.mid * 0.15);
    }
  }
  const sheets = tones.map((tone, index) => tone.paint(cell, color(index * 0.25 + phase * 0.02, 1, 45 + index * 10 + fx.hat * 15)));
  drawGlyphField(ctx, field, columns, rows, cell, sheets, tones[0].count);
}
