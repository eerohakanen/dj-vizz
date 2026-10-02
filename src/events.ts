import { registerDrop } from './audio/drop';
import { KEY_CONFIDENCE_FLOOR, keyHue, keyPalette, setPalette } from './color';
import { currentMode, setMode } from './mode';
import { MODES } from './modes/index';
import { shakeLevel } from './motion';
import { PALETTES } from './palettes';
import { changeOption } from './presets/change';
import { STRONG_PHRASE } from './modes/restyle';
import { playlist } from './presets/library';
import { currentChangeOn, nextPreset } from './presets/playlist';
import { fx, impulse, intensity, settings, signal } from './state';

const DOWNBEAT_HUE_BOOST = 1.6;
const MAX_PHRASES_PER_MODE = 4;

let phrasesInMode = 0;
let countedMode = -1;

function randomOtherMode() {
  let next;
  do next = (Math.random() * MODES.length) | 0;
  while (next === settings.mode);
  return next;
}

const neighbourPalette = () => 1 + (settings.palette % (PALETTES.length - 1));

function dropPalette() {
  if (signal.key >= 0 && signal.keyConfidence >= KEY_CONFIDENCE_FLOOR) return keyPalette(keyHue(signal.key), settings.palette);
  return 1 + Math.floor(Math.random() * (PALETTES.length - 1));
}

export function triggerDrop() {
  const claimed = currentMode().claimDrop();
  registerDrop();
  fx.drop = 1;
  fx.shake = 1.4 * shakeLevel();
  impulse.hue += 120 * settings.colorSpeed;
  fx.vortexDirection = -fx.vortexDirection;
  if (claimed) {
    if (settings.auto) setPalette(dropPalette(), true);
  } else if (playlist.playing && currentChangeOn() === 'drop') nextPreset();
  else if (settings.auto) {
    setMode(randomOtherMode());
    setPalette(dropPalette(), true);
  }
  currentMode().onDrop();
}

export function onBeat() {
  impulse.hue += (12 + impulse.beat * 20) * settings.colorSpeed * (signal.downbeat ? DOWNBEAT_HUE_BOOST : 1);
  const every = changeOption(currentChangeOn()).beats;
  const held = currentMode().busy();
  if (playlist.playing) {
    playlist.beats++;
    if (!held && every && playlist.beats >= every / 2 && signal.phraseBeat % every === 0) nextPreset();
  }
  currentMode().onBeat();
  fx.shake = Math.max(fx.shake, 0.22 * impulse.beat * intensity() * shakeLevel());
}

export function onPhrase(strength: number) {
  phrasesInMode = settings.mode === countedMode ? phrasesInMode + 1 : 1;
  countedMode = settings.mode;
  const sectionChange = strength >= STRONG_PHRASE || phrasesInMode >= MAX_PHRASES_PER_MODE;
  if (settings.auto && !playlist.playing && !currentMode().busy() && sectionChange) {
    phrasesInMode = 0;
    setMode(settings.mode + 1);
    return;
  }
  currentMode().onPhrase(strength);
  if (settings.auto && !playlist.playing) setPalette(neighbourPalette(), true);
}

export function onKick(strength: number) {
  impulse.kick = Math.max(impulse.kick, strength);
}

export function onSnare(strength: number) {
  impulse.snare = Math.max(impulse.snare, strength);
}

export function onHat(strength: number) {
  impulse.hat = Math.max(impulse.hat, strength);
}
