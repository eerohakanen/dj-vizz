import { showMessage } from './dom';
import { startTransition } from './effects/transition';
import { clamp, wrap } from './math';
import { allowStrobe, revokeStrobe, strobeActive } from './motion';
import { audio, disconnectAudio } from './audio/input';
import { flushAutosave } from './presets/autosave';
import { addScene, createFolder, duplicateScene, playlist, selectFolder } from './presets/library';
import { loadPreset, nextPreset, previousPreset, startPlaybackAt } from './presets/playlist';
import { settings, TUNING_DEFAULTS } from './state';
import { notify, ui, type LiveMode, type Overlay, type Screen } from './store';
import { MIRROR_NAMES, PSY_NAMES } from './effects/options';

type Settings = typeof settings;

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  if (key === 'strobe') (value ? allowStrobe : revokeStrobe)();
  settings[key] = value;
  notify();
}

type BooleanSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

export const toggleSetting = (key: BooleanSetting) => setSetting(key, key === 'strobe' ? !strobeActive() : !settings[key]);

export function setMirror(index: number) {
  startTransition();
  setSetting('mirror', wrap(index, MIRROR_NAMES.length));
}

export const cycleMirror = () => setMirror(settings.mirror + 1);

export const setPsy = (index: number) => setSetting('psy', wrap(index, PSY_NAMES.length));

export const cyclePsy = () => setPsy(settings.psy + 1);

export const setGain = (value: number) => setSetting('gain', clamp(value, 0, 100));

export const nudgeGain = (step: number) => setGain(settings.gain + step);

export function resetTuning() {
  Object.assign(settings, TUNING_DEFAULTS);
  notify();
}

export const fullscreenSupported = () => document.fullscreenEnabled;

export const toggleFullscreen = () => {
  if (!fullscreenSupported()) {
    showMessage('Fullscreen is not available on this device.');
    return;
  }
  const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  request.catch(() => showMessage('Could not change fullscreen.'));
};

export function syncFullscreen() {
  ui.fullscreen = !!document.fullscreenElement;
  notify();
}

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

function leaveLive(screen: Screen) {
  flushAutosave();
  playlist.playing = false;
  Object.assign(ui, { screen, overlay: null, paused: false, hideLocked: false, peek: false, controlsHidden: false });
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  notify();
}

export function leaveVisualizer() {
  disconnectAudio();
  leaveLive('landing');
}

export const openPresets = () => leaveLive('presets');

export const leaveSetup = () => (ui.liveMode === 'explore' ? leaveVisualizer() : openPresets());

export function goLive() {
  ui.screen = 'live';
  if (ui.liveMode === 'play') startPlaybackAt(0);
  if (ui.liveMode === 'edit') loadPreset(Math.max(playlist.selected, 0));
  notify();
}

function enter(mode: LiveMode) {
  flushAutosave();
  ui.liveMode = mode;
  playlist.playing = false;
  if (mode === 'edit') settings.auto = false;
  ui.overlay = mode === 'edit' ? 'scenes' : null;
  if (audio.live) goLive();
  else {
    ui.screen = 'setup';
    notify();
  }
}

export const explore = () => enter('explore');

export function enterPlay(index: number) {
  selectFolder(index);
  enter('play');
}

export function enterEdit(index: number) {
  selectFolder(index);
  enter('edit');
}

export function newPreset() {
  const index = createFolder();
  enterEdit(index);
  addScene();
}

export function switchToPlay() {
  flushAutosave();
  ui.liveMode = 'play';
  ui.overlay = null;
  startPlaybackAt(playlist.selected);
  notify();
}

export function switchToEdit() {
  ui.liveMode = 'edit';
  settings.auto = false;
  playlist.playing = false;
  ui.overlay = 'scenes';
  notify();
}

export function editScene(index: number) {
  flushAutosave();
  loadPreset(index);
}

export function captureScene() {
  flushAutosave();
  return addScene();
}

export function duplicateAndEditScene(index: number) {
  flushAutosave();
  const copy = duplicateScene(index);
  if (copy >= 0) loadPreset(copy);
  return copy;
}

export function nextScene() {
  flushAutosave();
  nextPreset();
}

export function previousScene() {
  flushAutosave();
  previousPreset();
}

export const openOverlay = (name: Overlay) => {
  ui.overlay = ui.overlay === name ? null : name;
  notify();
};

export const closeOverlay = () => {
  ui.overlay = null;
  notify();
};
