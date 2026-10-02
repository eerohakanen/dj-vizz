import { createGlyphSheet, DENSITY_RAMP, drawGlyphField, glyphGrid } from '../ascii';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { clamp01 } from '../math';
import { clock, fx, settings, signal } from '../state';
import { glideStyle, nextVariant } from './restyle';

const CELL = 12;
const VARIANTS = [
  { zoom: 1, vertical: 1.3, diagonal: 0.7, radial: 1.5, angle: 0 },
  { zoom: 1.6, vertical: 0.6, diagonal: 1.4, radial: 0.8, angle: 0.6 },
  { zoom: 0.7, vertical: 2, diagonal: 0.4, radial: 2.5, angle: -0.4 },
  { zoom: 1.2, vertical: 1, diagonal: 1, radial: 0.5, angle: 1.2 },
  { zoom: 0.85, vertical: 1.7, diagonal: 0.2, radial: 1.1, angle: -0.9 },
];

const tones = [createGlyphSheet(DENSITY_RAMP), createGlyphSheet(DENSITY_RAMP), createGlyphSheet(DENSITY_RAMP), createGlyphSheet(DENSITY_RAMP)];
let field = new Float32Array(0);
let phase = 0;
let lastRipple = -9;
let variant = 0;
const style = { ...VARIANTS[0] };

export function rippleAsciiPlasma() {
  lastRipple = clock.time;
}

export function restyleAsciiPlasma(strength: number) {
  variant = nextVariant(variant, VARIANTS.length, strength);
}

export function drawAsciiPlasma() {
  const { cell, columns, rows } = glyphGrid(CELL);
  if (field.length !== columns * rows) field = new Float32Array(columns * rows);
  glideStyle(style, VARIANTS[variant]);
  phase += clock.delta * settings.motion * (0.4 + signal.gate * (signal.energy * 2.5 + signal.punchBass * 1.5 + fx.drop * 4));
  const zoom = ((0.12 - signal.bass * 0.04) / (1 + fx.kick * 0.25)) * style.zoom;
  const ripple = (clock.time - lastRipple) * 30;
  const ringFade = Math.max(0, 1 - (clock.time - lastRipple) * 1.5);
  const lift = 0.15 + signal.gate * 0.4 + fx.beat * 0.35;
  const cos = Math.cos(style.angle);
  const sin = Math.sin(style.angle);
  const cx = columns / 2;
  const cy = rows / 2;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const along = (column - cx) * zoom;
      const across = (row - cy) * zoom * 2;
      const x = along * cos - across * sin;
      const y = along * sin + across * cos;
      const distance = Math.hypot(column - cx, (row - cy) * 2);
      const wave =
        Math.sin(x + phase) +
        Math.sin(y * style.vertical - phase * 1.2) +
        Math.sin((x + y) * style.diagonal + phase * 0.8) +
        Math.sin(distance * zoom * style.radial - phase * 2);
      const ring = Math.max(0, 1 - Math.abs(distance - ripple) / 4) * ringFade;
      field[row * columns + column] = clamp01(((wave + 4) / 8) * lift + ring * 0.8 + signal.mid * 0.15);
    }
  }
  const sheets = tones.map((tone, index) => tone.paint(cell, color(index * 0.25 + phase * 0.02, 1, 45 + index * 10 + fx.hat * 15)));
  drawGlyphField(ctx, field, columns, rows, cell, sheets, tones[0].count);
}
