import { showMessage } from './dom';
import { startTransition } from './effects/transition';
import { clamp, wrap } from './math';
import { PIXELATE_UNAVAILABLE, pixelateAvailable } from './mode';
import { audio, disconnectAudio } from './audio/input';
import { flushAutosave } from './presets/autosave';
import { addScene, createFolder, currentFolder, duplicateScene, playlist, selectFolder } from './presets/library';
import { loadPreset, nextPreset, previousPreset, startPlaybackAt } from './presets/playlist';
import { settings, TUNING_DEFAULTS } from './state';
import { notify, ui, type LiveMode, type Overlay, type Screen } from './store';
import { MIRROR_NAMES, PIXEL_NAMES, PSY_NAMES } from './effects/options';
import { MODE_CONTROLS } from './tuning';

type Settings = typeof settings;

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  settings[key] = value;
  notify();
}

type BooleanSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

export const toggleSetting = (key: BooleanSetting) => setSetting(key, !settings[key]);

export function setMirror(index: number) {
  startTransition();
  setSetting('mirror', wrap(index, MIRROR_NAMES.length));
}

export const cycleMirror = () => setMirror(settings.mirror + 1);

export const setPsy = (index: number) => setSetting('psy', wrap(index, PSY_NAMES.length));

export const cyclePsy = () => setPsy(settings.psy + 1);

export const setPixelate = (index: number) => setSetting('pixelate', wrap(index, PIXEL_NAMES.length));

export function cyclePixelate() {
  if (!pixelateAvailable()) {
    showMessage(PIXELATE_UNAVAILABLE);
    return;
  }
  setPixelate(settings.pixelate + 1);
}

export const setGain = (value: number) => setSetting('gain', clamp(value, 0, 100));

export const nudgeGain = (step: number) => setGain(settings.gain + step);

export function resetTuning() {
  Object.assign(settings, TUNING_DEFAULTS);
  notify();
}

export function resetModeTuning() {
  for (const { key } of MODE_CONTROLS) settings[key] = TUNING_DEFAULTS[key];
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

export type MenuScreen = Exclude<Screen, 'live'>;

export const setupBackTarget = (mode: LiveMode): MenuScreen => (mode === 'explore' ? 'landing' : 'presets');

export function menuTrail(screen: MenuScreen, mode: LiveMode): MenuScreen[] {
  if (screen === 'landing') return ['landing'];
  if (screen === 'presets') return ['landing', 'presets'];
  return [...menuTrail(setupBackTarget(mode), mode), 'setup'];
}

export const menuParent = (screen: MenuScreen, mode: LiveMode) => menuTrail(screen, mode).at(-2);

export function openMenuScreen(screen: MenuScreen) {
  if (screen === 'landing') leaveVisualizer();
  else if (screen === 'presets') openPresets();
}

export const leaveSetup = () => openMenuScreen(setupBackTarget(ui.liveMode));

export function goLive() {
  ui.screen = 'live';
  if (ui.liveMode === 'play') startPlaybackAt(0);
  if (ui.liveMode === 'edit') loadPreset(Math.max(playlist.selected, 0));
  notify();
}

export function finishSetup() {
  if (ui.screen === 'setup') goLive();
  else disconnectAudio();
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
  loadPreset(Math.max(playlist.selected, 0), { announce: false, transition: 'cut' });
  ui.overlay = 'scenes';
  notify();
}

export function editScene(index: number) {
  if (index === playlist.selected) return;
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

const canStepScenes = () => (currentFolder()?.presets.length ?? 0) > 1;

export function nextScene() {
  if (!canStepScenes()) return;
  flushAutosave();
  nextPreset();
}

export function previousScene() {
  if (!canStepScenes()) return;
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
