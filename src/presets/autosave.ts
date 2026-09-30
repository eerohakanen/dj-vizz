import { subscribe, ui } from '../store';
import { currentFolder, normalizePreset, overwritePreset, playlist, snapshot } from './library';

const AUTOSAVE_DELAY_MS = 300;

let timer: ReturnType<typeof setTimeout> | undefined;
let baseline: string | null = null;
let touched = false;

const lookJson = () => JSON.stringify(snapshot(''));

const editing = () => ui.screen === 'live' && ui.liveMode === 'edit';

export function markSceneClean() {
  baseline = lookJson();
  touched = false;
}

function dirtyScene() {
  if (!editing()) return -1;
  touched ||= baseline === null || lookJson() !== baseline;
  if (!touched) return -1;
  const scene = currentFolder()?.presets[playlist.selected];
  if (!scene) return -1;
  const same = JSON.stringify(snapshot(scene.name)) === JSON.stringify(normalizePreset(scene));
  return same ? -1 : playlist.selected;
}

export function flushAutosave() {
  clearTimeout(timer);
  timer = undefined;
  const index = dirtyScene();
  if (index >= 0) overwritePreset(index);
}

function scheduleAutosave() {
  if (!editing()) {
    baseline = null;
    touched = false;
    return;
  }
  if (dirtyScene() < 0) return;
  clearTimeout(timer);
  timer = setTimeout(flushAutosave, AUTOSAVE_DELAY_MS);
}

export function startAutosave() {
  const unsubscribe = subscribe(scheduleAutosave);
  return () => {
    unsubscribe();
    clearTimeout(timer);
    timer = undefined;
    baseline = null;
    touched = false;
  };
}
