import { decodeAnimation } from '../animation';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { wobble } from '../math';
import { createPlayhead, frameAt } from '../playhead';
import { clock, fx, signal, view } from '../state';
import { drawSprite, tinted } from './sprite';
import { createKick, lazyStage } from './three-stage';

const DANCES = ['hips', 'snap', 'skip', 'slide', 'balancing'];
const LEAD_HEIGHT = 0.6;
const BACKUP_HEIGHT = 0.42;
const BACKUP_SPACING = 0.22;
const FLOOR = 0.86;
const TINT = 0.35;

const kick = createKick();
const playhead = createPlayhead();
let danceIndex = 0;

const dances = lazyStage(() => Promise.all(DANCES.map((name) => decodeAnimation(`${name}.gif`, 'image/gif'))), 'Dancer failed to load');

function drawGlow(x: number, floorY: number, radius: number, alpha: number) {
  const gradient = ctx.createRadialGradient(x, floorY - radius * 0.6, 0, x, floorY - radius * 0.6, radius);
  gradient.addColorStop(0, color(0.2, alpha * 0.55));
  gradient.addColorStop(1, color(0.8, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, floorY - radius * 1.6, radius * 2, radius * 2);
  ctx.fillStyle = color(0.5, alpha * 0.35);
  ctx.beginPath();
  ctx.ellipse(x, floorY, radius * 0.45, radius * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFigure(frame: ImageBitmap, x: number, floorY: number, height: number, mirrored: boolean, style: string) {
  drawSprite(tinted(frame, style, TINT), x, floorY - kick.value * height * 0.06, height, { mirrored, squash: kick.value * 0.12, smooth: false });
}

function drawBackups(frame: ImageBitmap, cx: number, floorY: number) {
  if (fx.drop < 0.02) return;
  const { width, height } = view;
  ctx.globalAlpha = Math.min(1, fx.drop * 1.5);
  for (const slot of [-2, -1, 1, 2]) {
    const x = cx + slot * width * BACKUP_SPACING;
    drawFigure(frame, x, floorY - height * 0.04, height * BACKUP_HEIGHT, slot < 0, color(0.5 + slot * 0.2));
  }
  ctx.globalAlpha = 1;
}

export function pulseDancer() {
  kick.pulse();
}

export function switchDance() {
  danceIndex++;
  playhead.restart();
}

export function drawDancer() {
  const loaded = dances.get();
  if (!loaded) return;
  kick.decay();
  const { width, height } = view;
  const dance = loaded[danceIndex % loaded.length];
  const frame = dance.frames[frameAt(playhead.advance(dance.loopSeconds), dance.delays)];
  const shake = fx.shake * view.minSide * 0.03;
  const cx = width / 2 + wobble(clock.time, 0) * shake;
  const floorY = height * FLOOR + wobble(clock.time, 1) * shake;
  const leadHeight = height * LEAD_HEIGHT * (1 + signal.gate * signal.punchBass * 0.05);
  drawGlow(cx, floorY, leadHeight * (0.7 + kick.value * 0.3 + fx.drop * 0.4), 0.5 + signal.energy * 0.5);
  drawBackups(frame, cx, floorY);
  drawFigure(frame, cx, floorY, leadHeight, false, color(fx.beat * 0.3));
}
