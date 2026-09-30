import { subscribe, ui } from '../store';
import { currentFolder, overwritePreset, playlist, snapshot } from './library';

const AUTOSAVE_DELAY_MS = 300;

let timer: ReturnType<typeof setTimeout> | undefined;

function dirtyScene() {
  if (ui.screen !== 'live' || ui.liveMode !== 'edit') return -1;
  const scene = currentFolder()?.presets[playlist.selected];
  if (!scene) return -1;
  const current = snapshot(scene.name);
  const same = JSON.stringify(current) === JSON.stringify({ ...current, ...scene, effects: { ...current.effects, ...scene.effects }, tuning: { ...current.tuning, ...scene.tuning } });
  return same ? -1 : playlist.selected;
}

export function flushAutosave() {
  clearTimeout(timer);
  timer = undefined;
  const index = dirtyScene();
  if (index >= 0) overwritePreset(index);
}

function scheduleAutosave() {
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
  };
}
