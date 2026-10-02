import { BACKGROUND, outputCtx, scene, sceneCtx } from './canvas';
import { applyBloom } from './effects/bloom';
import { drawLasers } from './effects/lasers';
import { applyMirror } from './effects/mirror';
import { applyPixelate } from './effects/pixelate';
import { drawTransition } from './effects/transition';
import { frameAlpha, frameScale, wobble } from './math';
import { currentMode, setMode } from './mode';
import { MODES } from './modes/index';
import { motionScale, shakeLevel } from './motion';
import { clock, fx, intensity, settings, signal, view } from './state';

const LIQUID_STRIPS = 40;
const WASH_RATE = 0.3;
const TRAIL_LENGTH = 0.86;
const TRAIL_CALM_SHORTENING = 0.15;
const CALM_DAMPING = 0.6;

let washAngle = 0;
let washHue = NaN;
let wash: CanvasGradient | undefined;

const calmScale = () => 1 - CALM_DAMPING * fx.calm;

function feedPreviousFrame(ctx: CanvasRenderingContext2D) {
  const { width, height } = view;
  const { gate, punchBass, punchMid } = signal;
  const step = frameScale(clock.delta);
  const cx = width / 2 + Math.sin(clock.time * 0.7) * width * 0.07 * fx.vortexMix;
  const cy = height / 2 + Math.cos(clock.time * 0.53) * height * 0.07 * fx.vortexMix;
  const rotation =
    ((signal.mid - 0.25) * 0.01 * gate + fx.drop * 0.04) * intensity() +
    fx.vortexMix * (0.015 + punchMid * 0.04) * fx.vortexDirection;
  const zoom =
    1 +
    gate * (0.006 + punchBass * 0.015 + fx.kick * 0.02 + signal.tension * 0.02) +
    fx.drop * 0.05 +
    fx.vortexMix * (0.012 + punchBass * 0.035);
  ctx.save();
  ctx.globalAlpha = Math.min(0.95, frameAlpha(TRAIL_LENGTH * (1 - TRAIL_CALM_SHORTENING * fx.calm) + fx.vortexMix * 0.07, clock.delta));
  ctx.translate(cx, cy);
  ctx.rotate(rotation * step);
  ctx.scale(Math.pow(zoom, step), Math.pow(zoom, step));
  ctx.translate(-cx, -cy);
  ctx.drawImage(scene, 0, 0);
  ctx.restore();
}

function applyBeatShake(ctx: CanvasRenderingContext2D) {
  const { width, height, pixelRatio } = view;
  const punch = 1 + (fx.kick * 0.04 + fx.beat * 0.015 + fx.drop * 0.1) * intensity() * shakeLevel() * signal.gate;
  const shake = (fx.shake + signal.tension * signal.tension * 0.12 * motionScale()) * calmScale();
  const amplitude = shake * 60 * pixelRatio;
  ctx.translate(width / 2 + wobble(clock.time, 0) * amplitude, height / 2 + wobble(clock.time, 1) * amplitude);
  ctx.scale(punch, punch);
  ctx.translate(-width / 2, -height / 2);
}

export function renderScene() {
  const ctx = sceneCtx;
  const { width, height } = view;
  const mode = currentMode();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const feedback = mode.trails || fx.vortexMix > 0.02;
  if (feedback && signal.gate > 0.01) feedPreviousFrame(ctx);
  ctx.globalAlpha = frameAlpha(feedback ? 0.13 : mode.fade, clock.delta);
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;

  ctx.save();
  applyBeatShake(ctx);
  ctx.globalCompositeOperation = mode.opaque ? 'source-over' : 'lighten';
  mode.draw();
  const next = mode.handoff();
  if (next) setMode(MODES.findIndex((candidate) => candidate.name === next), 'cut');
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighten';
  drawLasers();
  ctx.restore();
}

function drawLiquid(o: CanvasRenderingContext2D) {
  const { width, height, pixelRatio } = view;
  const { time } = clock;
  const stripHeight = height / LIQUID_STRIPS;
  const amplitude = fx.liquidMix * (8 + signal.punchMid * 50 + fx.beat * 40) * pixelRatio;
  o.fillStyle = BACKGROUND;
  o.fillRect(0, 0, width, height);
  for (let i = 0; i < LIQUID_STRIPS; i++) {
    const y = Math.floor(i * stripHeight);
    const h = Math.min(height - y, Math.ceil(stripHeight) + 1);
    const shift =
      Math.sin((i / LIQUID_STRIPS) * 18.85 + time * 3) * amplitude +
      Math.sin(i * 0.9 + time * 7) * amplitude * 0.35 * signal.punchHigh;
    if (h > 0) o.drawImage(scene, 0, y, width, h, shift, y, width, h);
  }
}

function washGradient(o: CanvasRenderingContext2D) {
  const hue = Math.floor(fx.hue);
  if (wash && hue === washHue) return wash;
  washHue = hue;
  wash = o.createConicGradient(0, 0, 0);
  for (let i = 0; i <= 6; i++) wash.addColorStop(i / 6, `hsl(${((i * 60 + fx.hue) % 360) | 0},100%,50%)`);
  return wash;
}

function drawRainbowWash(o: CanvasRenderingContext2D) {
  const { width, height, diagonal } = view;
  washAngle += clock.delta * WASH_RATE * settings.colorSpeed;
  o.save();
  o.globalCompositeOperation = 'hue';
  o.globalAlpha = fx.rainbowMix * 0.85;
  o.fillStyle = washGradient(o);
  o.translate(width / 2, height / 2);
  o.rotate(fx.spin * 1.5 + washAngle);
  o.fillRect(-diagonal, -diagonal, diagonal * 2, diagonal * 2);
  o.restore();
}

export function presentFrame() {
  const o = outputCtx;
  o.globalCompositeOperation = 'source-over';
  o.globalAlpha = 1;
  if (fx.liquidMix > 0.02) drawLiquid(o);
  else o.drawImage(scene, 0, 0);
  applyMirror(o);
  applyBloom(o);
  if (fx.rainbowMix > 0.02) drawRainbowWash(o);
  o.globalCompositeOperation = 'source-over';
  applyPixelate(o);
  drawTransition(o);
}
