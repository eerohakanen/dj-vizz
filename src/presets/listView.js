import { $, escapeHtml, setButtonOn } from '../dom.js';
import { MODES } from '../modes/index.js';
import { PALETTES } from '../palettes.js';
import { MIRROR_NAMES, PSY_NAMES } from '../ui.js';
import { currentFolder, library, playlist } from './library.js';

const EMPTY_LIST = '<li><span class="empty">No presets yet. Set up a look and press Save look.</span></li>';

function describe(preset) {
  const parts = [MODES[preset.mode]?.name || '?', PALETTES[preset.pal]?.name || '?'];
  if (preset.psy) parts.push(PSY_NAMES[preset.psy]);
  if (preset.kal) parts.push(MIRROR_NAMES[preset.kal]);
  return parts.join(' · ');
}

const actionButton = (action, index, title, label) =>
  `<button data-a="${action}" data-i="${index}" title="${title}">${label}</button>`;

function presetItem(preset, index) {
  const current = index === playlist.selected ? ' class="cur"' : '';
  return (
    `<li${current}><span class="nm" data-a="load" data-i="${index}">${escapeHtml(preset.name)}` +
    `<small>${escapeHtml(describe(preset))}</small></span>` +
    actionButton('up', index, 'Move up', '▲') +
    actionButton('dn', index, 'Move down', '▼') +
    actionButton('upd', index, 'Overwrite with current look', '⟳') +
    actionButton('del', index, 'Delete', '✕') +
    '</li>'
  );
}

function renderFolders() {
  $('fSel').innerHTML = library.folders
    .map((folder, index) => {
      const selected = index === library.cur ? ' selected' : '';
      return `<option value="${index}"${selected}>${escapeHtml(folder.name)} (${folder.presets.length})</option>`;
    })
    .join('');
}

export function renderPresetList() {
  const { presets } = currentFolder();
  $('pList').innerHTML = presets.length ? presets.map(presetItem).join('') : EMPTY_LIST;
  renderFolders();
  $('plBtn').textContent = playlist.playing ? '■ Stop playing' : '▶ Play folder';
  setButtonOn('plBtn', playlist.playing);
}
