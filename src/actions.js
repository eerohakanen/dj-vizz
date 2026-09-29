import { disconnectAudio } from './audio/input.js';
import { showMessage } from './dom.js';
import { startTransition } from './effects/transition.js';
import { playlist } from './presets/library.js';
import { settings } from './state.js';
import { notify, ui } from './store.js';
import { MIRROR_NAMES, PSY_NAMES } from './ui.js';

export function setSetting(key, value) {
  settings[key] = value;
  notify();
}

export const toggleSetting = (key) => setSetting(key, !settings[key]);

export function setMirror(index) {
  startTransition();
  setSetting('mirror', (index + MIRROR_NAMES.length) % MIRROR_NAMES.length);
}

export const cycleMirror = () => setMirror(settings.mirror + 1);

export const setPsy = (index) => setSetting('psy', (index + PSY_NAMES.length) % PSY_NAMES.length);

export const cyclePsy = () => setPsy(settings.psy + 1);

export const setGain = (value) => setSetting('gain', Math.max(0, Math.min(100, value)));

export const nudgeGain = (step) => setGain(settings.gain + step);

export const toggleFullscreen = () =>
  document.fullscreenElement
    ? document.exitFullscreen()
    : document.documentElement.requestFullscreen().catch(() => {});

export function togglePaused() {
  ui.paused = !ui.paused;
  notify();
}

export function setControlsHidden(hidden) {
  if (ui.controlsHidden === hidden) return;
  ui.controlsHidden = hidden;
  notify();
}

export function setHideLocked(locked) {
  ui.hideLocked = locked;
  ui.controlsHidden = locked;
  ui.peek = false;
  if (locked) showMessage('Controls hidden. Press H to bring them back.');
  notify();
}

export function setPeek(peek) {
  if (ui.peek === peek) return;
  ui.peek = peek;
  notify();
}

export function leaveVisualizer() {
  disconnectAudio();
  playlist.playing = false;
  Object.assign(ui, { live: false, overlay: null, paused: false, hideLocked: false, peek: false, controlsHidden: false });
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  notify();
}

export const openOverlay = (name) => {
  ui.overlay = ui.overlay === name ? null : name;
  notify();
};

export const closeOverlay = () => {
  ui.overlay = null;
  notify();
};
