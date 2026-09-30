import './index.css';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { analyse } from './audio/analysis';
import { adaptQuality, resize } from './canvas';
import { advancePaletteFade, buildLut } from './color';
import { bindControls } from './controls';
import { advanceTimedPlaylist } from './presets/playlist';
import { presentFrame, renderScene } from './render';
import { clock, fx, settings } from './state';
import { ui } from './store';
import { PSY_NAMES } from './ui';

let lastTimestamp = 0;

const approach = (value: number, target: number, speed: number) => value + (target - value) * Math.min(1, clock.delta * speed);

function psyTarget(name: string) {
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

function frame(timestamp: number) {
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
createRoot(document.getElementById('root')!).render(<App />);
requestAnimationFrame(frame);
