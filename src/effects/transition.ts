import { BEATS_PER_BAR } from '../audio/tempo';
import { output, transitionCtx, transitionFrame as frame } from '../canvas';
import { color } from '../color';
import { clamp, smoothstep, TAU } from '../math';
import { comfort } from '../motion';
import { clock, signal, view } from '../state';

const DEFAULT_DURATION = 1.1;
const MIN_DURATION = 0.6;
const MAX_DURATION = 2.4;
const STYLE_COUNT = 4;
const CROSSFADE = STYLE_COUNT;
const STRIPS = 24;

let startedAt = -9;
let duration = DEFAULT_DURATION;
let style = 0;

export const transitionDuration = (bpm: number) =>
  bpm > 0 ? clamp((BEATS_PER_BAR * 60) / bpm, MIN_DURATION, MAX_DURATION) : DEFAULT_DURATION;

export const transitionStyle = (reducedMotion: boolean, random: number) =>
  reducedMotion ? CROSSFADE : Math.min(STYLE_COUNT - 1, (random * STYLE_COUNT) | 0);

export function startTransition() {
  if (clock.time < 0.5) return;
  transitionCtx.drawImage(output, 0, 0);
  startedAt = clock.time;
  duration = transitionDuration(signal.bpm);
  style = transitionStyle(comfort.reduced, Math.random());
}

function zoomOut(o: CanvasRenderingContext2D, eased: number) {
  const { width, height } = view;
  const scale = 1 + eased * 0.8;
  o.globalAlpha = 1 - eased;
  o.translate(width / 2, height / 2);
  o.scale(scale, scale);
  o.translate(-width / 2, -height / 2);
  o.drawImage(frame, 0, 0);
}

function crossfade(o: CanvasRenderingContext2D, eased: number) {
  o.globalAlpha = 1 - eased;
  o.drawImage(frame, 0, 0);
}

function spinAway(o: CanvasRenderingContext2D, eased: number) {
  const { width, height } = view;
  const scale = 1 - eased * 0.7;
  o.globalAlpha = 1 - eased;
  o.translate(width / 2, height / 2);
  o.rotate(eased * 2.2);
  o.scale(scale, scale);
  o.translate(-width / 2, -height / 2);
  o.drawImage(frame, 0, 0);
}

function irisOpen(o: CanvasRenderingContext2D, eased: number) {
  const { width, height, diagonal, pixelRatio } = view;
  const radius = Math.max(1, eased * diagonal * 0.55);
  o.beginPath();
  o.rect(0, 0, width, height);
  o.arc(width / 2, height / 2, radius, 0, TAU);
  o.clip('evenodd');
  o.drawImage(frame, 0, 0);
  o.restore();
  o.save();
  o.globalCompositeOperation = 'lighter';
  o.strokeStyle = color(0, 1 - eased);
  o.lineWidth = 14 * pixelRatio;
  o.beginPath();
  o.arc(width / 2, height / 2, radius, 0, TAU);
  o.stroke();
}

function dropStrips(o: CanvasRenderingContext2D, eased: number, progress: number) {
  const { width, height } = view;
  const stripWidth = width / STRIPS;
  o.globalAlpha = 1 - eased * 0.5;
  for (let i = 0; i < STRIPS; i++) {
    const fall = Math.pow(progress, 1.6) * height * 1.2 * (0.5 + ((i * 7919) % 13) / 13);
    const x = Math.floor(i * stripWidth);
    const w = Math.min(width - x, Math.ceil(stripWidth) + 1);
    o.drawImage(frame, x, 0, w, height, x, fall, w, height);
  }
}

const STYLES = [zoomOut, spinAway, irisOpen, dropStrips, crossfade];

export function drawTransition(o: CanvasRenderingContext2D) {
  const progress = (clock.time - startedAt) / duration;
  if (progress >= 1 || progress < 0) return;
  o.save();
  STYLES[style](o, smoothstep(progress), progress);
  o.restore();
}
