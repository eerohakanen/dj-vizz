import { disconnectAudio } from './audio/input';
import { showMessage } from './dom';
import { startTransition } from './effects/transition';
import { playlist } from './presets/library';
import { settings } from './state';
import { notify, ui, type Overlay } from './store';
import { MIRROR_NAMES, PSY_NAMES } from './ui';

type Settings = typeof settings;

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  settings[key] = value;
  notify();
}

type BooleanSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

export const toggleSetting = (key: BooleanSetting) => setSetting(key, !settings[key]);

export function setMirror(index: number) {
  startTransition();
  setSetting('mirror', (index + MIRROR_NAMES.length) % MIRROR_NAMES.length);
}

export const cycleMirror = () => setMirror(settings.mirror + 1);

export const setPsy = (index: number) => setSetting('psy', (index + PSY_NAMES.length) % PSY_NAMES.length);

export const cyclePsy = () => setPsy(settings.psy + 1);

export const setGain = (value: number) => setSetting('gain', Math.max(0, Math.min(100, value)));

export const nudgeGain = (step: number) => setGain(settings.gain + step);

export const toggleFullscreen = () =>
  document.fullscreenElement
    ? document.exitFullscreen()
    : document.documentElement.requestFullscreen().catch(() => {});

export function togglePaused() {
  ui.paused = !ui.paused;
  notify();
}

export function setControlsHidden(hidden: boolean) {
  if (ui.controlsHidden === hidden) return;
  ui.controlsHidden = hidden;
  notify();
}

export function setHideLocked(locked: boolean) {
  ui.hideLocked = locked;
  ui.controlsHidden = locked;
  ui.peek = false;
  if (locked) showMessage('Controls hidden. Press H to bring them back.');
  notify();
}

export function toggleDebug() {
  ui.debug = !ui.debug;
  notify();
}

export function setPeek(peek: boolean) {
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

export const openOverlay = (name: Overlay) => {
  ui.overlay = ui.overlay === name ? null : name;
  notify();
};

export const closeOverlay = () => {
  ui.overlay = null;
  notify();
};
