import './index.css';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { syncAccent } from './accent';
import { analyse } from './audio/analysis';
import { adaptQuality, output, resize } from './canvas';
import { advancePaletteFade, buildLut } from './color';
import { bindControls } from './controls';
import { psyIndex, type PsyName } from './effects/options';
import { onBeat, onHat, onKick, onSnare, triggerDrop } from './events';
import { bindReducedMotion } from './motion';
import { advanceTimedPlaylist, shiftPlaylistClock } from './presets/playlist';
import { flushAutosave, startAutosave } from './presets/autosave';
import { approach } from './math';
import { presentFrame, renderScene } from './render';
import { restoreSession, saveSession } from './session';
import { clock, fx, settings } from './state';
import { subscribe, ui } from './store';

const ANALYSIS_EVENTS = { onBeat, onKick, onSnare, onHat, onDrop: triggerDrop };

let lastTimestamp = 0;
let wasPaused = false;

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

const visualsShown = () => ui.screen === 'live';

function syncCanvasVisibility() {
  output.hidden = !visualsShown();
}

function frame(timestamp: number) {
  const elapsed = timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  const accentDelta = Math.min(0.05, Math.max(0, elapsed / 1000));
  if (ui.paused || !visualsShown()) {
    wasPaused = true;
    buildLut();
    syncAccent(accentDelta);
    requestAnimationFrame(frame);
    return;
  }
  const time = timestamp / 1000;
  if (wasPaused) shiftPlaylistClock(time - clock.time);
  wasPaused = false;
  clock.time = time;
  clock.delta = Math.min(0.05, Math.max(0.001, elapsed / 1000));
  if (elapsed > 0 && elapsed < 100 && !document.hidden) adaptQuality(elapsed);
  updateEffectMixes();
  advancePaletteFade(clock.delta);
  advanceTimedPlaylist();
  analyse(ANALYSIS_EVENTS);
  buildLut();
  syncAccent(accentDelta);
  renderScene();
  presentFrame();
  requestAnimationFrame(frame);
}

restoreSession();
startAutosave();
bindReducedMotion();
addEventListener('pagehide', () => {
  flushAutosave();
  saveSession();
});
addEventListener('resize', () => {
  resize();
  if (ui.paused && visualsShown()) presentFrame();
});
resize();
syncCanvasVisibility();
subscribe(syncCanvasVisibility);
bindControls();
createRoot(document.getElementById('root')!).render(<App />);
requestAnimationFrame(frame);
