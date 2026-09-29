import { $, showMessage } from '../dom.js';
import { MODES } from '../modes/index.js';
import { PALETTES } from '../palettes.js';
import { clock, settings } from '../state.js';
import { NAME_LIMIT, currentFolder, importFolders, library, playlist, saveLibrary, snapshot } from './library.js';
import { renderPresetList } from './listView.js';
import { loadPreset, togglePlayback } from './playlist.js';

function ask(question, fallback) {
  try {
    const answer = prompt(question, fallback);
    return answer == null ? null : answer.trim();
  } catch {
    return fallback;
  }
}

function commit() {
  saveLibrary();
  renderPresetList();
}

function selectFolder(index) {
  library.cur = index;
  playlist.selected = playlist.index = -1;
  commit();
}

export function togglePanel() {
  $('pp').classList.toggle('show');
  renderPresetList();
}

function createFolder() {
  const name = ask('New folder name', `Folder ${library.folders.length + 1}`);
  if (!name) return;
  library.folders.push({ name: name.slice(0, NAME_LIMIT), presets: [] });
  selectFolder(library.folders.length - 1);
}

function renameFolder() {
  const name = ask('Rename folder', currentFolder().name);
  if (!name) return;
  currentFolder().name = name.slice(0, NAME_LIMIT);
  commit();
}

function deleteFolder() {
  const folder = currentFolder();
  let confirmed = false;
  try {
    confirmed = confirm(`Delete folder "${folder.name}" and its ${folder.presets.length} presets?`);
  } catch {}
  if (!confirmed) return;
  library.folders.splice(library.cur, 1);
  if (!library.folders.length) library.folders.push({ name: 'My set', presets: [] });
  playlist.playing = false;
  selectFolder(0);
}

function savePreset() {
  const folder = currentFolder();
  const fallbackName = `${MODES[settings.mode].name} · ${PALETTES[settings.palette].name}`;
  const name = ($('pName').value.trim() || fallbackName).slice(0, NAME_LIMIT);
  folder.presets.push(snapshot(name));
  $('pName').value = '';
  playlist.selected = folder.presets.length - 1;
  commit();
  showMessage(`Saved "${name}" to ${folder.name}`);
}

function swapPresets(presets, a, b) {
  [presets[a], presets[b]] = [presets[b], presets[a]];
  if (playlist.selected === a) playlist.selected = b;
  else if (playlist.selected === b) playlist.selected = a;
}

function handleListClick(event) {
  const target = event.target.closest('[data-a]');
  if (!target) return;
  const index = +target.dataset.i;
  const action = target.dataset.a;
  const { presets } = currentFolder();
  if (action === 'load') loadPreset(index);
  else if (action === 'up' && index > 0) swapPresets(presets, index, index - 1);
  else if (action === 'dn' && index < presets.length - 1) swapPresets(presets, index, index + 1);
  else if (action === 'upd') {
    presets[index] = snapshot(presets[index].name);
    showMessage(`Updated "${presets[index].name}"`);
  } else if (action === 'del') {
    presets.splice(index, 1);
    if (playlist.selected === index) playlist.selected = -1;
    else if (playlist.selected > index) playlist.selected--;
    playlist.index = playlist.selected;
  }
  commit();
}

function exportLibrary() {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(library, null, 1)], { type: 'application/json' }));
  link.download = 'visualizer-presets.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

async function importFile(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    const count = importFolders(JSON.parse(await file.text()));
    selectFolder(library.folders.length - 1);
    showMessage(`Imported ${count} folder${count === 1 ? '' : 's'}`);
  } catch {
    showMessage('Could not read that file. Use a file made with Export.');
  }
}

export function bindPresetPanel() {
  $('ppX').onclick = togglePanel;
  $('fSel').onchange = () => selectFolder(+$('fSel').value);
  $('fNew').onclick = createFolder;
  $('fRen').onclick = renameFolder;
  $('fDel').onclick = deleteFolder;
  $('pSave').onclick = savePreset;
  $('pName').onkeydown = (event) => {
    if (event.key === 'Enter') savePreset();
  };
  $('pList').onclick = handleListClick;
  $('plBy').onchange = () => {
    playlist.changeOn = $('plBy').value;
    playlist.beats = 0;
    playlist.startedAt = clock.time;
  };
  $('plShuf').onchange = () => {
    playlist.shuffle = $('plShuf').checked;
  };
  $('plBtn').onclick = togglePlayback;
  $('pExp').onclick = exportLibrary;
  $('pImp').onchange = importFile;
  $('pp').addEventListener('click', (event) => {
    if (event.target.tagName === 'BUTTON') event.target.blur();
  });
  renderPresetList();
}
