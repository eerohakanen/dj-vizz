import './index.css';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { analyse } from './audio/analysis';
import { adaptQuality, resize } from './canvas';
import { advancePaletteFade, buildLut } from './color';
import { bindControls } from './controls';
import { psyIndex, type PsyName } from './effects/options';
import { bindReducedMotion } from './motion';
import { advanceTimedPlaylist } from './presets/playlist';
import { approach } from './math';
import { presentFrame, renderScene } from './render';
import { restoreSession, saveSession } from './session';
import { clock, fx, settings } from './state';
import { ui } from './store';

let lastTimestamp = 0;

function psyTarget(name: PsyName) {
  const active = settings.psy;
  return active === psyIndex(name) || active === psyIndex('Trip') ? 1 : 0;
}

function updateEffectMixes() {
  fx.laserMix = approach(fx.laserMix, settings.lasers ? 1 : 0, 4, clock.delta);
  fx.vortexMix = approach(fx.vortexMix, psyTarget('Vortex'), 1.5, clock.delta);
  fx.liquidMix = approach(fx.liquidMix, psyTarget('Liquid'), 2.5, clock.delta);
  fx.rainbowMix = approach(fx.rainbowMix, psyTarget('Rainbow'), 1.5, clock.delta);
  fx.tripMix = approach(fx.tripMix, psyTarget('Trip'), 2.5, clock.delta);
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

restoreSession();
bindReducedMotion();
addEventListener('pagehide', saveSession);
addEventListener('resize', () => {
  resize();
  if (ui.paused) presentFrame();
});
resize();
bindControls();
createRoot(document.getElementById('root')!).render(<App />);
requestAnimationFrame(frame);
