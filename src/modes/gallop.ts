import { decodeAnimation } from '../animation';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { wobble, wrap } from '../math';
import { createPlayhead, frameAt } from '../playhead';
import { clock, fx, signal, view } from '../state';
import { drawSprite, tinted } from './sprite';
import { createKick, lazyStage } from './three-stage';

const HORSE_HEIGHT = 0.42;
const GROUND = 0.72;
const STRIDE = 1.6;
const MARKER_SPACING = 0.12;
const STAMPEDE = [
  { scale: 0.62, rise: 0.2, shift: -0.18, phase: 1 / 3 },
  { scale: 0.45, rise: 0.33, shift: 0.16, phase: 2 / 3 },
];

const kick = createKick();
const playhead = createPlayhead();
let scroll = 0;
let lastPosition = 0;

const horse = lazyStage(() => decodeAnimation('horse.png', 'image/png'), 'Gallop failed to load');

const loopStep = (from: number, to: number) => wrap(to - from + 0.5, 1) - 0.5;

function drawTrack(groundY: number, horseHeight: number) {
  const { width } = view;
  const spacing = width * MARKER_SPACING;
  const offset = wrap(scroll, spacing);
  ctx.strokeStyle = color(0.7, 0.25 + kick.value * 0.25);
  ctx.lineWidth = Math.max(1, view.pixelRatio);
  ctx.beginPath();
  for (let x = -offset; x < width + spacing; x += spacing) {
    ctx.moveTo(x, groundY - horseHeight * 1.15);
    ctx.lineTo(x, groundY);
  }
  ctx.moveTo(0, groundY);
  ctx.lineTo(width, groundY);
  ctx.stroke();
  ctx.fillStyle = color(0.4, 0.5);
  ctx.font = `${Math.round(horseHeight * 0.07)}px monospace`;
  for (let x = -offset, n = Math.floor(scroll / spacing); x < width + spacing; x += spacing, n++) ctx.fillText(String(wrap(n, 24) + 1), x + 4, groundY - 4);
}

function drawHorse(frame: ImageBitmap, x: number, groundY: number, height: number, style: string) {
  drawSprite(tinted(frame, style, 1), x, groundY - kick.value * height * 0.05, height);
}

function drawStampede(frames: ImageBitmap[], delays: number[], cx: number, groundY: number, height: number) {
  if (fx.drop < 0.02) return;
  ctx.globalAlpha = Math.min(1, fx.drop * 1.5) * 0.7;
  for (const row of STAMPEDE) {
    const frame = frames[frameAt(playhead.position + row.phase, delays)];
    drawHorse(frame, cx + row.shift * view.width, groundY - row.rise * height, height * row.scale, color(0.5 + row.phase * 0.4));
  }
  ctx.globalAlpha = 1;
}

export function pulseGallop() {
  kick.pulse();
}

export function dropGallop() {
  playhead.restart();
  lastPosition = 0;
}

export function drawGallop() {
  const loaded = horse.get();
  if (!loaded) return;
  kick.decay();
  const { width, height } = view;
  const { frames, delays } = loaded;
  const position = playhead.advance(loaded.loopSeconds);
  const horseHeight = height * HORSE_HEIGHT * (1 + signal.gate * signal.punchBass * 0.04);
  scroll += loopStep(lastPosition, position) * horseHeight * STRIDE * (loaded.width / loaded.height);
  lastPosition = position;
  const shake = fx.shake * view.minSide * 0.03;
  const cx = width / 2 + wobble(clock.time, 0) * shake;
  const groundY = height * GROUND + wobble(clock.time, 1) * shake;
  drawTrack(groundY, horseHeight);
  drawStampede(frames, delays, cx, groundY, horseHeight);
  drawHorse(frames[frameAt(position, delays)], cx, groundY, horseHeight, color(fx.beat * 0.3, 1, 65));
}
