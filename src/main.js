import './styles.css';
import { analyse } from './audio/analysis.js';
import { adaptQuality, resize } from './canvas.js';
import { advancePaletteFade, buildLut, renderPaletteButton } from './color.js';
import { bindControls } from './controls.js';
import { bindPresetPanel } from './presets/panel.js';
import { advanceTimedPlaylist } from './presets/playlist.js';
import { presentFrame, renderScene } from './render.js';
import { clock, fx, settings } from './state.js';
import { PSY_NAMES } from './ui.js';

let lastTimestamp = 0;

const approach = (value, target, speed) => value + (target - value) * Math.min(1, clock.delta * speed);

function psyTarget(name) {
  const active = PSY_NAMES[settings.psy];
  return active === name || active === 'Trip' ? 1 : 0;
}

function updateEffectMixes() {
  fx.laserMix = approach(fx.laserMix, settings.lasers ? 1 : 0, 4);
  fx.vortexMix = approach(fx.vortexMix, psyTarget('Vortex'), 1.5);
  fx.liquidMix = approach(fx.liquidMix, psyTarget('Liquid'), 2.5);
  fx.rainbowMix = approach(fx.rainbowMix, psyTarget('Rainbow'), 1.5);
  fx.tripMix = approach(fx.tripMix, psyTarget('Trip'), 2.5);
}

function frame(timestamp) {
  const elapsed = timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  clock.time = timestamp / 1000;
  clock.delta = Math.min(0.05, Math.max(0.001, elapsed / 1000));
  if (elapsed > 0 && elapsed < 100 && !document.hidden) adaptQuality(elapsed);
  updateEffectMixes();
  advancePaletteFade(clock.delta);
  advanceTimedPlaylist();
  analyse();
  buildLut();
  renderScene();
  presentFrame();
  requestAnimationFrame(frame);
}

addEventListener('resize', resize);
resize();
bindControls();
bindPresetPanel();
renderPaletteButton();
requestAnimationFrame(frame);
