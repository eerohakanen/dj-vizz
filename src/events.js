import { setPalette } from './color.js';
import { addShockwave, burst } from './effects/particles.js';
import { currentMode, setMode } from './mode.js';
import { MODES } from './modes/index.js';
import { PALETTES } from './palettes.js';
import { playlist } from './presets/library.js';
import { nextPreset } from './presets/playlist.js';
import { clock, fx, settings, signal, view } from './state.js';

const AUTO_MODE_EVERY = 32;
const BEATS_PER_CHANGE = { b16: 16, b32: 32 };

function randomOtherMode() {
  let next;
  do next = (Math.random() * MODES.length) | 0;
  while (next === settings.mode);
  return next;
}

export function triggerDrop() {
  signal.lastDrop = clock.time;
  signal.breakdown = 0;
  signal.energyPeak = signal.energy;
  fx.drop = 1;
  fx.flash = 1;
  fx.shake = 1.4;
  fx.hue += 120;
  fx.vortexDirection = -fx.vortexDirection;
  addShockwave(0);
  addShockwave(70 * view.pixelRatio);
  addShockwave(140 * view.pixelRatio);
  burst(300, 4, 28, 1.8);
  if (settings.strobe) fx.invert = 1;
  if (settings.glitch) fx.glitchAmount = 1.2;
  if (playlist.playing && playlist.changeOn === 'drop') nextPreset();
  else if (settings.auto) {
    setMode(randomOtherMode());
    setPalette(1 + Math.floor(Math.random() * (PALETTES.length - 1)), true);
  }
}

export function onBeat() {
  fx.hue += 12 + fx.beat * 20;
  fx.beatCount++;
  if (playlist.playing) {
    playlist.beats++;
    if (playlist.beats >= BEATS_PER_CHANGE[playlist.changeOn]) nextPreset();
  } else if (settings.auto && fx.beatCount % AUTO_MODE_EVERY === 0) {
    setMode(settings.mode + 1);
  }
  currentMode().onBeat();
  fx.shake = Math.max(fx.shake, 0.22 * fx.beat * settings.reactivity);
  if (settings.strobe) fx.strobeFlash = 1;
  if (settings.glitch && fx.beat > 0.6) fx.glitchAmount = Math.max(fx.glitchAmount, fx.beat);
  if (fx.beat > 0.8) addShockwave();
  burst((10 + fx.beat * 25 * settings.reactivity) | 0, 2, 9, 1);
}
