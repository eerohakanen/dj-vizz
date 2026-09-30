import { showMessage } from '../dom';
import { clock, settings } from '../state';
import { notify } from '../store';
import { applyPreset, currentFolder, playlist, selectFolder } from './library';

export function loadPreset(index: number) {
  const { presets } = currentFolder();
  const preset = presets[index];
  if (!preset) return;
  playlist.selected = playlist.index = index;
  playlist.beats = 0;
  playlist.startedAt = clock.time;
  applyPreset(preset);
  showMessage(`▶ ${preset.name}  (${index + 1}/${presets.length})`);
  notify();
}

export function nextPreset() {
  const count = currentFolder().presets.length;
  if (!count) return;
  let index: number;
  if (playlist.shuffle && count > 1) {
    do index = (Math.random() * count) | 0;
    while (index === playlist.index);
  } else {
    index = (playlist.index + 1) % count;
  }
  loadPreset(index);
}

export function togglePlayback() {
  if (playlist.playing) {
    playlist.playing = false;
    showMessage(`Stopped playing ${currentFolder().name}`);
  } else {
    if (!currentFolder().presets.length) {
      showMessage('This folder is empty. Save a look first.');
      return;
    }
    playlist.playing = true;
    settings.auto = false;
    playlist.index = -1;
    nextPreset();
  }
  notify();
}

export function advanceTimedPlaylist() {
  if (!playlist.playing || playlist.changeOn[0] !== 's') return;
  if (clock.time - playlist.startedAt >= +playlist.changeOn.slice(1)) nextPreset();
}

export function setChangeOn(changeOn: string) {
  playlist.changeOn = changeOn;
  playlist.beats = 0;
  playlist.startedAt = clock.time;
  notify();
}

export function setShuffle(shuffle: boolean) {
  playlist.shuffle = shuffle;
  notify();
}

export function playFolder(index: number) {
  selectFolder(index);
  playlist.playing = false;
  togglePlayback();
}
