import { createGlyphSheet, DENSITY_RAMP, drawGlyphField, glyphGrid } from '../ascii';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { approach, decay, lerp, smoothstep, TAU } from '../math';
import { clock, fx, settings, signal } from '../state';
import { nextVariant, STYLE_RATE } from './restyle';

const KNOTS = [
  { p: 2, q: 3, tube: 0.55 },
  { p: 3, q: 2, tube: 0.5 },
  { p: 2, q: 5, tube: 0.42 },
  { p: 3, q: 4, tube: 0.36 },
  { p: 3, q: 5, tube: 0.32 },
  { p: 5, q: 3, tube: 0.34 },
];
const PATH_STEPS = 900;
const TUBE_STEPS = 48;
const FRAME_STRIDE = 12;
const CAMERA_DISTANCE = 7;
const CELL = 11;
const LIGHT = normalize(0.3, 0.6, -0.75);

const tones = [createGlyphSheet(DENSITY_RAMP), createGlyphSheet(DENSITY_RAMP), createGlyphSheet(DENSITY_RAMP)];
const curve = new Float32Array(PATH_STEPS * FRAME_STRIDE);
const fromCurve = new Float32Array(PATH_STEPS * FRAME_STRIDE);
const toCurve = new Float32Array(PATH_STEPS * FRAME_STRIDE);
const style = { knot: 0, morph: 1, tube: KNOTS[0].tube };
let depth = new Float32Array(0);
let shade = new Float32Array(0);
let angleA = 0;
let angleB = 0;
let spinKick = 0;

function normalize(x: number, y: number, z: number) {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function knotPoint(p: number, q: number, t: number, out: Float32Array, offset: number) {
  const radius = Math.cos(q * t) + 2;
  out[offset] = radius * Math.cos(p * t);
  out[offset + 1] = radius * Math.sin(p * t);
  out[offset + 2] = -Math.sin(q * t);
}

function buildCurve({ p, q }: (typeof KNOTS)[number], target: Float32Array) {
  const ahead = new Float32Array(3);
  for (let i = 0; i < PATH_STEPS; i++) {
    const t = (i / PATH_STEPS) * TAU;
    const offset = i * FRAME_STRIDE;
    knotPoint(p, q, t, target, offset);
    knotPoint(p, q, t + 0.001, ahead, 0);
    const [tx, ty, tz] = normalize(ahead[0] - target[offset], ahead[1] - target[offset + 1], ahead[2] - target[offset + 2]);
    const [bx, by, bz] = normalize(ty, -tx, 0);
    const [nx, ny, nz] = normalize(by * tz - bz * ty, bz * tx - bx * tz, bx * ty - by * tx);
    target.set([nx, ny, nz, bx, by, bz, tx, ty, tz], offset + 3);
  }
}

buildCurve(KNOTS[0], toCurve);
curve.set(toCurve);

function blendVector(offset: number, blend: number) {
  const [x, y, z] = normalize(
    lerp(fromCurve[offset], toCurve[offset], blend),
    lerp(fromCurve[offset + 1], toCurve[offset + 1], blend),
    lerp(fromCurve[offset + 2], toCurve[offset + 2], blend),
  );
  curve.set([x, y, z], offset);
}

function morphCurve() {
  const settled = style.morph >= 0.999;
  style.morph = approach(style.morph, 1, STYLE_RATE, clock.delta);
  style.tube = approach(style.tube, KNOTS[style.knot].tube, STYLE_RATE, clock.delta);
  if (settled) return;
  if (style.morph >= 0.999) {
    curve.set(toCurve);
    return;
  }
  const blend = smoothstep(style.morph);
  for (let i = 0; i < PATH_STEPS; i++) {
    const offset = i * FRAME_STRIDE;
    for (let axis = 0; axis < 3; axis++) curve[offset + axis] = lerp(fromCurve[offset + axis], toCurve[offset + axis], blend);
    blendVector(offset + 3, blend);
    blendVector(offset + 6, blend);
  }
}

export function restyleAsciiKnot(strength: number) {
  fromCurve.set(curve);
  style.knot = nextVariant(style.knot, KNOTS.length, strength);
  buildCurve(KNOTS[style.knot], toCurve);
  style.morph = 0;
}

export function kickAsciiKnot() {
  spinKick += 2.5;
}

function rasterize(columns: number, rows: number, scale: number) {
  const cosA = Math.cos(angleA);
  const sinA = Math.sin(angleA);
  const cosB = Math.cos(angleB);
  const sinB = Math.sin(angleB);
  const thickness = style.tube * (0.8 + signal.punchBass * 0.45 + fx.kick * 0.35 + fx.snare * 0.2);
  for (let i = 0; i < PATH_STEPS; i++) {
    const o = i * FRAME_STRIDE;
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
  morphCurve();
  const step = clock.delta * settings.motion;
  spinKick *= decay(0.15, clock.delta);
  angleA += step * (0.3 + signal.gate * (signal.mid * 1.2 + spinKick));
  angleB += step * (0.2 + signal.gate * (signal.punchBass * 1.8 + fx.drop * 4 + spinKick));
  rasterize(columns, rows, Math.min(columns, rows) * 0.8 * (1 + fx.kick * 0.22 + fx.drop * 0.3));
  const sheets = tones.map((tone, index) => tone.paint(cell, color(0.15 + index * 0.12 + fx.beat * 0.1, 1, 40 + index * 20 + fx.hat * 15)));
  drawGlyphField(ctx, shade, columns, rows, cell, sheets, tones[0].count);
}
