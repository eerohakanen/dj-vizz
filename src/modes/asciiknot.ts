import { createGlyphSheet, DENSITY_RAMP, drawGlyphField, glyphGrid } from '../ascii';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { decay, TAU } from '../math';
import { clock, fx, settings, signal } from '../state';

const KNOT_P = 2;
const KNOT_Q = 3;
const PATH_STEPS = 900;
const TUBE_STEPS = 48;
const TUBE_RADIUS = 0.55;
const CAMERA_DISTANCE = 7;
const CELL = 11;
const LIGHT = normalize(0.3, 0.6, -0.75);

const tones = [createGlyphSheet(DENSITY_RAMP), createGlyphSheet(DENSITY_RAMP), createGlyphSheet(DENSITY_RAMP)];
const curve = new Float32Array(PATH_STEPS * 12);
let depth = new Float32Array(0);
let shade = new Float32Array(0);
let angleA = 0;
let angleB = 0;
let spinKick = 0;

function normalize(x: number, y: number, z: number) {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function knotPoint(t: number, out: Float32Array, offset: number) {
  const radius = Math.cos(KNOT_Q * t) + 2;
  out[offset] = radius * Math.cos(KNOT_P * t);
  out[offset + 1] = radius * Math.sin(KNOT_P * t);
  out[offset + 2] = -Math.sin(KNOT_Q * t);
}

function buildCurve() {
  const ahead = new Float32Array(3);
  for (let i = 0; i < PATH_STEPS; i++) {
    const t = (i / PATH_STEPS) * TAU;
    const offset = i * 12;
    knotPoint(t, curve, offset);
    knotPoint(t + 0.001, ahead, 0);
    const [tx, ty, tz] = normalize(ahead[0] - curve[offset], ahead[1] - curve[offset + 1], ahead[2] - curve[offset + 2]);
    const [bx, by, bz] = normalize(ty, -tx, 0);
    const [nx, ny, nz] = normalize(by * tz - bz * ty, bz * tx - bx * tz, bx * ty - by * tx);
    curve.set([nx, ny, nz, bx, by, bz, tx, ty, tz], offset + 3);
  }
}

buildCurve();

export function kickAsciiKnot() {
  spinKick += 2.5;
}

function rasterize(columns: number, rows: number, scale: number) {
  const cosA = Math.cos(angleA);
  const sinA = Math.sin(angleA);
  const cosB = Math.cos(angleB);
  const sinB = Math.sin(angleB);
  const thickness = TUBE_RADIUS * (0.8 + signal.punchBass * 0.45 + fx.kick * 0.35 + fx.snare * 0.2);
  for (let i = 0; i < PATH_STEPS; i++) {
    const o = i * 12;
    for (let j = 0; j < TUBE_STEPS; j++) {
      const around = (j / TUBE_STEPS) * TAU;
      const c = Math.cos(around);
      const s = Math.sin(around);
      const nx = curve[o + 3] * c + curve[o + 6] * s;
      const ny = curve[o + 4] * c + curve[o + 7] * s;
      const nz = curve[o + 5] * c + curve[o + 8] * s;
      const px = curve[o] + nx * thickness;
      const py = curve[o + 1] + ny * thickness;
      const pz = curve[o + 2] + nz * thickness;
      const y1 = py * cosA - pz * sinA;
      const z1 = py * sinA + pz * cosA;
      const x2 = px * cosB + z1 * sinB;
      const z2 = -px * sinB + z1 * cosB;
      const inverseDepth = 1 / (z2 + CAMERA_DISTANCE);
      const column = Math.floor(columns / 2 + x2 * scale * inverseDepth);
      const row = Math.floor(rows / 2 - y1 * scale * inverseDepth);
      if (column < 0 || column >= columns || row < 0 || row >= rows) continue;
      const cell = row * columns + column;
      if (inverseDepth <= depth[cell]) continue;
      depth[cell] = inverseDepth;
      const ny1 = ny * cosA - nz * sinA;
      const nz1 = ny * sinA + nz * cosA;
      const nx2 = nx * cosB + nz1 * sinB;
      const nz2 = -nx * sinB + nz1 * cosB;
      shade[cell] = Math.min(1, Math.max(0.08, nx2 * LIGHT[0] + ny1 * LIGHT[1] + nz2 * LIGHT[2]) * (0.55 + signal.gate * 0.3 + fx.beat * 0.45));
    }
  }
}

export function drawAsciiKnot() {
  const { cell, columns, rows } = glyphGrid(CELL);
  if (depth.length !== columns * rows) {
    depth = new Float32Array(columns * rows);
    shade = new Float32Array(columns * rows);
  }
  depth.fill(0);
  shade.fill(0);
  const step = clock.delta * settings.motion;
  spinKick *= decay(0.15, clock.delta);
  angleA += step * (0.3 + signal.gate * (signal.mid * 1.2 + spinKick));
  angleB += step * (0.2 + signal.gate * (signal.punchBass * 1.8 + fx.drop * 4 + spinKick));
  rasterize(columns, rows, Math.min(columns, rows) * 0.8 * (1 + fx.kick * 0.22 + fx.drop * 0.3));
  const sheets = tones.map((tone, index) => tone.paint(cell, color(0.15 + index * 0.12 + fx.beat * 0.1, 1, 40 + index * 20 + fx.hat * 15)));
  drawGlyphField(ctx, shade, columns, rows, cell, sheets, tones[0].count);
}
