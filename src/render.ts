import { BACKGROUND, fillWith, gradientCache, outputCtx, scene, sceneCtx } from './canvas';
import { color } from './color';
import { applyBloom } from './effects/bloom';
import { applyGlitch } from './effects/glitch';
import { drawLasers } from './effects/lasers';
import { applyMirror } from './effects/mirror';
import { drawParticles, drawShockwaves } from './effects/particles';
import { applyPixelate } from './effects/pixelate';
import { drawTransition } from './effects/transition';
import { clamp01, frameAlpha, frameScale, signedRandom } from './math';
import { currentMode } from './mode';
import { flashLevel, motionScale, shakeLevel } from './motion';
import { clock, fx, settings, signal, view } from './state';

const LIQUID_STRIPS = 40;
const WASH_RATE = 0.3;
const TRAIL_CALM_SHORTENING = 0.15;
const CALM_DAMPING = 0.6;

let washAngle = 0;
let washHue = NaN;
let wash: CanvasGradient | undefined;

const centerGlow = gradientCache(() => sceneCtx.createRadialGradient(0, 0, 0, 0, 0, 1));

const calmScale = () => 1 - CALM_DAMPING * fx.calm;

function feedPreviousFrame(ctx: CanvasRenderingContext2D) {
  const { width, height } = view;
  const { gate, punchBass, punchMid } = signal;
  const step = frameScale(clock.delta);
  const cx = width / 2 + Math.sin(clock.time * 0.7) * width * 0.07 * fx.vortexMix;
  const cy = height / 2 + Math.cos(clock.time * 0.53) * height * 0.07 * fx.vortexMix;
  const rotation =
    ((signal.mid - 0.25) * 0.01 * gate + fx.drop * 0.04) * settings.reactivity +
    fx.vortexMix * (0.015 + punchMid * 0.04) * fx.vortexDirection;
  const zoom =
    1 +
    gate * (0.006 + punchBass * 0.015 + fx.kick * 0.02 + signal.tension * 0.02) +
    fx.drop * 0.05 +
    fx.vortexMix * (0.012 + punchBass * 0.035);
  ctx.save();
  ctx.globalAlpha = Math.min(0.95, frameAlpha(settings.trailLength * (1 - TRAIL_CALM_SHORTENING * fx.calm) + fx.vortexMix * 0.07, clock.delta));
  ctx.translate(cx, cy);
  ctx.rotate(rotation * step);
  ctx.scale(Math.pow(zoom, step), Math.pow(zoom, step));
  ctx.translate(-cx, -cy);
  ctx.drawImage(scene, 0, 0);
  ctx.restore();
}

function drawCenterGlow(ctx: CanvasRenderingContext2D) {
  const { width, height, diagonal } = view;
  const radius = diagonal * 0.55;
  const intensity = 0.07 * signal.punchBass + 0.2 * fx.drop + 0.12 * signal.tension + 0.08 * signal.vocal;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = clamp01(Math.min(0.35, intensity));
  ctx.fillStyle = centerGlow(color(0, 1, 40 + signal.vocal * 15), 'rgba(0,0,0,0)');
  ctx.translate(width / 2, height / 2);
  ctx.scale(radius, radius);
  ctx.fillRect(-width / 2 / radius, -height / 2 / radius, width / radius, height / radius);
  ctx.restore();
}

function applyBeatShake(ctx: CanvasRenderingContext2D) {
  const { width, height, pixelRatio } = view;
  const punch = 1 + (fx.kick * 0.04 + fx.beat * 0.015 + fx.drop * 0.1) * settings.reactivity * shakeLevel() * signal.gate;
  const shake = (fx.shake + signal.tension * signal.tension * 0.12 * motionScale()) * calmScale();
  const jitter = () => signedRandom(shake * 60 * pixelRatio);
  ctx.translate(width / 2 + jitter(), height / 2 + jitter());
  ctx.scale(punch, punch);
  ctx.translate(-width / 2, -height / 2);
}

export function renderScene() {
  const ctx = sceneCtx;
  const { width, height } = view;
  const mode = currentMode();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const feedback = (settings.trails && mode.trails) || fx.vortexMix > 0.02;
  if (feedback && signal.gate > 0.01) feedPreviousFrame(ctx);
  ctx.globalAlpha = frameAlpha(feedback ? 0.13 : mode.fade, clock.delta);
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;
  if (signal.gate > 0.02 && !mode.opaque) drawCenterGlow(ctx);

  ctx.save();
  applyBeatShake(ctx);
  ctx.globalCompositeOperation = mode.opaque ? 'source-over' : 'lighter';
  mode.draw();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  drawShockwaves();
  drawParticles();
  ctx.globalAlpha = 1;
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

function drawFlashes(o: CanvasRenderingContext2D) {
  const calm = calmScale();
  if (fx.tripMix > 0.02 && fx.beat > 0.3) fillWith(o, 'difference', color(0, fx.beat * 0.55 * fx.tripMix * flashLevel() * calm, 60));
  if (fx.strobeFlash > 0.02) fillWith(o, 'lighter', color(0, fx.strobeFlash * 0.45 * calm, 70));
  if (fx.snare > 0.05) fillWith(o, 'lighter', color(0.5, fx.snare * 0.18 * Math.min(1, settings.reactivity) * flashLevel() * calm, 75));
  if (fx.invert > 0.02) {
    o.globalAlpha = clamp01(fx.invert);
    fillWith(o, 'difference', '#fff');
    o.globalAlpha = 1;
  }
  o.globalCompositeOperation = 'source-over';
  if (fx.flash > 0.02) {
    o.globalAlpha = clamp01(fx.flash * 0.75 * calm);
    fillWith(o, 'source-over', '#fff');
    o.globalAlpha = 1;
  }
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
  applyGlitch(o);
  drawFlashes(o);
}
