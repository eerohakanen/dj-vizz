import { decodeAnimation } from '../animation';
import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { wobble } from '../math';
import { createPlayhead, frameAt } from '../playhead';
import { clock, fx, signal, view } from '../state';
import { drawSprite, tinted } from './sprite';
import { createKick, lazyStage } from './three-stage';

const FILM_HEIGHT = 0.78;
const SIDE_HEIGHT = 0.5;
const SIDE_SPACING = 0.3;
const ECHO_LIFE = 1.2;
const ECHO_LIMIT = 3;
const SPROCKETS = 7;

interface Echo {
  position: number;
  age: number;
}

const kick = createKick();
const playhead = createPlayhead();
const echoes: Echo[] = [];

const waltz = lazyStage(() => decodeAnimation('waltz.png', 'image/png'), 'Waltz failed to load');

function drawSprockets(left: number, top: number, filmWidth: number, filmHeight: number) {
  const pitch = filmHeight / SPROCKETS;
  const hole = pitch * 0.45;
  const travel = (playhead.position * SPROCKETS * 4) % 1;
  ctx.fillStyle = color(0.6, 0.35 + kick.value * 0.3);
  for (let i = -1; i <= SPROCKETS; i++) {
    const y = top + (i + travel) * pitch + (pitch - hole) / 2;
    if (y < top || y + hole > top + filmHeight) continue;
    for (const x of [left - hole * 1.6, left + filmWidth + hole * 0.6]) ctx.fillRect(x, y, hole, hole);
  }
}

function drawFilm(frame: ImageBitmap, x: number, floorY: number, height: number, style: string, mirrored = false) {
  drawSprite(tinted(frame, style, 1, 'multiply'), x, floorY, height, { mirrored });
}

function drawEchoes(frames: ImageBitmap[], delays: number[], x: number, floorY: number, height: number) {
  ctx.globalCompositeOperation = 'screen';
  for (const echo of echoes) {
    const life = 1 - echo.age / ECHO_LIFE;
    ctx.globalAlpha = life * 0.35;
    const grow = 1 + echo.age * 0.18;
    drawFilm(frames[frameAt(echo.position, delays)], x, floorY + height * (grow - 1) * 0.5, height * grow, color(0.8));
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function ageEchoes() {
  for (const echo of echoes) echo.age += clock.delta;
  while (echoes.length && echoes[0].age > ECHO_LIFE) echoes.shift();
}

export function pulseWaltz() {
  kick.pulse();
  echoes.push({ position: playhead.position, age: 0 });
  if (echoes.length > ECHO_LIMIT) echoes.shift();
}

export function dropWaltz() {
  playhead.restart();
}

export function drawWaltz() {
  const film = waltz.get();
  if (!film) return;
  kick.decay();
  ageEchoes();
  const { width, height } = view;
  const { frames, delays } = film;
  const frame = frames[frameAt(playhead.advance(film.loopSeconds), delays)];
  const weave = view.minSide * (0.003 + fx.shake * 0.03);
  const cx = width / 2 + wobble(clock.time * 0.3, 0) * weave;
  const filmHeight = height * FILM_HEIGHT * (1 + kick.value * 0.03);
  const floorY = (height + filmHeight) / 2 + wobble(clock.time * 0.3, 1) * weave;
  const filmWidth = (filmHeight * film.width) / film.height;
  if (fx.drop > 0.02) {
    ctx.globalAlpha = Math.min(1, fx.drop * 1.5);
    for (const side of [-1, 1]) {
      const offset = frames[frameAt(playhead.position + side / 3, delays)];
      drawFilm(offset, cx + side * width * SIDE_SPACING, floorY - (filmHeight - height * SIDE_HEIGHT) / 2, height * SIDE_HEIGHT, color(0.5 + side * 0.25), side < 0);
    }
    ctx.globalAlpha = 1;
  }
  const flicker = 0.88 + wobble(clock.time, 2) * 0.12 + kick.value * 0.12 + signal.punchHigh * 0.05;
  ctx.globalAlpha = Math.min(1, flicker);
  drawFilm(frame, cx, floorY, filmHeight, color(fx.beat * 0.3, 1, 70));
  ctx.globalAlpha = 1;
  drawEchoes(frames, delays, cx, floorY, filmHeight);
  drawSprockets(cx - filmWidth / 2, floorY - filmHeight, filmWidth, filmHeight);
}
