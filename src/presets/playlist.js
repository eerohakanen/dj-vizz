import { setButtonOn, showMessage } from '../dom.js';
import { clock, settings } from '../state.js';
import { applyPreset, currentFolder, playlist } from './library.js';
import { renderPresetList } from './listView.js';

export function loadPreset(index) {
  const { presets } = currentFolder();
  const preset = presets[index];
  if (!preset) return;
  playlist.selected = playlist.index = index;
  playlist.beats = 0;
  playlist.startedAt = clock.time;
  applyPreset(preset);
  showMessage(`▶ ${preset.name}  (${index + 1}/${presets.length})`);
  renderPresetList();
}

export function nextPreset() {
  const count = currentFolder().presets.length;
  if (!count) return;
  let index;
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
    if (settings.auto) {
      settings.auto = false;
      setButtonOn('bAuto', false);
    }
    playlist.index = -1;
    nextPreset();
  }
  renderPresetList();
}

export function advanceTimedPlaylist() {
  if (!playlist.playing || playlist.changeOn[0] !== 's') return;
  if (clock.time - playlist.startedAt >= +playlist.changeOn.slice(1)) nextPreset();
}
