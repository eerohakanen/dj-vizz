import { releaseTension } from './audio/musical';
import { anchorPhrase } from './audio/tempo';
import { KEY_CONFIDENCE_FLOOR, keyHue, keyPalette, setPalette } from './color';
import { currentMode, setMode } from './mode';
import { MODES } from './modes/index';
import { flashLevel, shakeLevel, strobeActive } from './motion';
import { PALETTES } from './palettes';
import { changeOption } from './presets/change';
import { playlist } from './presets/library';
import { currentChangeOn, nextPreset } from './presets/playlist';
import { clock, fx, settings, signal } from './state';

const DOWNBEAT_HUE_BOOST = 1.6;

function randomOtherMode() {
  let next;
  do next = (Math.random() * MODES.length) | 0;
  while (next === settings.mode);
  return next;
}

function dropPalette() {
  if (signal.key >= 0 && signal.keyConfidence >= KEY_CONFIDENCE_FLOOR) return keyPalette(keyHue(signal.key), settings.palette);
  return 1 + Math.floor(Math.random() * (PALETTES.length - 1));
}

export function triggerDrop() {
  signal.lastDrop = clock.time;
  signal.breakdown = 0;
  anchorPhrase();
  releaseTension();
  signal.energyPeak = signal.energy;
  fx.drop = 1;
  fx.flash = flashLevel();
  fx.shake = 1.4 * shakeLevel();
  fx.hue += 120 * settings.colorSpeed;
  fx.vortexDirection = -fx.vortexDirection;
  if (strobeActive()) fx.invert = flashLevel();
  if (settings.glitch) fx.glitchAmount = 1.2;
  if (playlist.playing && currentChangeOn() === 'drop') nextPreset();
  else if (settings.auto) {
    setMode(randomOtherMode());
    setPalette(dropPalette(), true);
  }
  currentMode().onDrop();
}

export function onBeat() {
  fx.hue += (12 + fx.beat * 20) * settings.colorSpeed * (signal.downbeat ? DOWNBEAT_HUE_BOOST : 1);
  const every = changeOption(currentChangeOn()).beats;
  if (playlist.playing) {
    playlist.beats++;
    if (every && playlist.beats >= every / 2 && signal.phraseBeat % every === 0) nextPreset();
  } else if (settings.auto && signal.phraseBeat === 0) {
    setMode(settings.mode + 1);
  }
  currentMode().onBeat();
  fx.shake = Math.max(fx.shake, 0.22 * fx.beat * settings.reactivity * shakeLevel());
  if (strobeActive()) fx.strobeFlash = flashLevel();
  if (settings.glitch && fx.beat > 0.6) fx.glitchAmount = Math.max(fx.glitchAmount, fx.beat);
}

export function onKick(strength: number) {
  fx.kick = Math.max(fx.kick, strength);
}

export function onSnare(strength: number) {
  fx.snare = Math.max(fx.snare, strength);
}

export function onHat(strength: number) {
  fx.hat = Math.max(fx.hat, strength);
}
