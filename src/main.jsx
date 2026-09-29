import './index.css';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.jsx';
import { analyse } from './audio/analysis.js';
import { adaptQuality, resize } from './canvas.js';
import { advancePaletteFade, buildLut } from './color.js';
import { bindControls } from './controls.js';
import { advanceTimedPlaylist } from './presets/playlist.js';
import { presentFrame, renderScene } from './render.js';
import { clock, fx, settings } from './state.js';
import { ui } from './store.js';
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
  if (ui.paused) {
    requestAnimationFrame(frame);
    return;
  }
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

addEventListener('resize', () => {
  resize();
  if (ui.paused) presentFrame();
});
resize();
bindControls();
createRoot(document.getElementById('root')).render(<App />);
requestAnimationFrame(frame);
