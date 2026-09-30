import { showMessage } from '../dom';
import { clock, settings } from '../state';
import { notify } from '../store';
import type { TransitionKind } from '../effects/transition';
import { changeOption, DEFAULT_CHANGE_ON, type ChangeOn } from './change';
import { applyPreset, currentFolder, playlist, saveLibrary } from './library';

export const currentChangeOn = () => currentFolder()?.changeOn ?? DEFAULT_CHANGE_ON;

export const currentShuffle = () => currentFolder()?.shuffle ?? false;

export function loadPreset(index: number) {
  const folder = currentFolder();
  const preset = folder?.presets[index];
  if (!folder || !preset) return;
  const { presets } = folder;
  playlist.selected = playlist.index = index;
  playlist.beats = 0;
  playlist.startedAt = clock.time;
  applyPreset(preset, folder.transition);
  if (!playlist.playing) showMessage(`▶ ${preset.name}  (${index + 1}/${presets.length})`);
  notify();
}

export function nextPreset() {
  const count = currentFolder()?.presets.length ?? 0;
  if (!count) return;
  let index: number;
  if (currentShuffle() && count > 1) {
    do index = (Math.random() * count) | 0;
    while (index === playlist.index);
  } else {
    index = (playlist.index + 1) % count;
  }
  loadPreset(index);
}

export function previousPreset() {
  const count = currentFolder()?.presets.length ?? 0;
  if (!count) return;
  loadPreset((Math.max(playlist.index, 0) - 1 + count) % count);
}

export function startPlaybackAt(index: number) {
  const folder = currentFolder();
  if (!folder?.presets.length) {
    showMessage('This preset is empty. Add a scene first.');
    return;
  }
  playlist.playing = true;
  settings.auto = false;
  loadPreset(index < folder.presets.length ? Math.max(index, 0) : 0);
}

export function advanceTimedPlaylist() {
  if (!playlist.playing) return;
  const { seconds } = changeOption(currentChangeOn());
  if (seconds && clock.time - playlist.startedAt >= seconds) nextPreset();
}

export function shiftPlaylistClock(gap: number) {
  playlist.startedAt += gap;
}

export function setChangeOn(changeOn: ChangeOn) {
  const folder = currentFolder();
  if (!folder) return;
  folder.changeOn = changeOn;
  playlist.beats = 0;
  playlist.startedAt = clock.time;
  saveLibrary();
}

export function setShuffle(shuffle: boolean) {
  const folder = currentFolder();
  if (!folder) return;
  folder.shuffle = shuffle;
  saveLibrary();
}

export function setTransition(transition: TransitionKind) {
  const folder = currentFolder();
  if (!folder) return;
  folder.transition = transition;
  saveLibrary();
}
