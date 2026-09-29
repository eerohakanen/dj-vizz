import { setPalette } from '../color.js';
import { setMode } from '../mode.js';
import { MODES } from '../modes/index.js';
import { PALETTES } from '../palettes.js';
import { settings } from '../state.js';
import { notify } from '../store.js';
import { MIRROR_NAMES, PSY_NAMES } from '../ui.js';

const STORAGE_KEY = 'djviz.presets.v2';
const LEGACY_STORAGE_KEY = 'djviz.presets.v1';
const LIBRARY_VERSION = 2;
export const NAME_LIMIT = 40;

export const createPreset = (name, mode, palette, overrides) => ({
  name,
  mode,
  pal: palette,
  psy: 0,
  kal: 0,
  fb: true,
  las: false,
  gl: false,
  stb: false,
  gain: 27,
  agc: false,
  react: 0.6,
  ...overrides,
});

const starterLibrary = () => ({
  version: LIBRARY_VERSION,
  cur: 0,
  folders: [
    {
      name: 'Starter',
      presets: [
        createPreset('Warp · Fire', 6, 5),
        createPreset('Hypno vortex', 9, 7, { psy: 1 }),
        createPreset('Kaleido galaxy', 4, 1, { kal: 3 }),
        createPreset('Laser tunnel', 2, 11, { las: true }),
        createPreset('Liquid bars', 0, 2, { psy: 2 }),
        createPreset('Rainbow hex', 8, 0, { psy: 3, gl: true }),
      ],
    },
  ],
});

const REMOVED_PALETTE = 1;

function migrateLegacyPalettes(data) {
  if (data.version === LIBRARY_VERSION) return data;
  for (const folder of data.folders) {
    for (const preset of folder?.presets ?? []) {
      if (preset && typeof preset.pal === 'number' && preset.pal > REMOVED_PALETTE) preset.pal--;
    }
  }
  data.version = LIBRARY_VERSION;
  return data;
}

function readStored(key) {
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    return stored && Array.isArray(stored.folders) && stored.folders.length ? stored : null;
  } catch {
    return null;
  }
}

function loadLibrary() {
  const stored = readStored(STORAGE_KEY) ?? readStored(LEGACY_STORAGE_KEY);
  const loaded = stored ? migrateLegacyPalettes(stored) : starterLibrary();
  loaded.cur = Math.min(Math.max(0, loaded.cur | 0), loaded.folders.length - 1);
  return loaded;
}

export const library = loadLibrary();

export const playlist = {
  playing: false,
  changeOn: 'b32',
  shuffle: false,
  index: -1,
  selected: -1,
  beats: 0,
  startedAt: 0,
};

export function saveLibrary() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch {}
  notify();
}

export const currentFolder = () => library.folders[library.cur];

export function snapshot(name) {
  return {
    name,
    mode: settings.mode,
    pal: settings.palette,
    psy: settings.psy,
    kal: settings.mirror,
    fb: settings.trails,
    las: settings.lasers,
    gl: settings.glitch,
    stb: settings.strobe,
    gain: settings.gain,
    agc: settings.autoGain,
    react: settings.reactivity,
  };
}

const isNumber = (value) => typeof value === 'number' && isFinite(value);
const wrap = (value, count) => ((value % count) + count) % count;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function applyPreset(preset) {
  if (!preset) return;
  setMode(isNumber(preset.mode) ? preset.mode : settings.mode);
  if (isNumber(preset.pal) && preset.pal !== settings.palette) setPalette(preset.pal, true);
  settings.psy = isNumber(preset.psy) ? wrap(preset.psy, PSY_NAMES.length) : 0;
  settings.mirror = isNumber(preset.kal) ? wrap(preset.kal, MIRROR_NAMES.length) : 0;
  settings.trails = !!preset.fb;
  settings.lasers = !!preset.las;
  settings.glitch = !!preset.gl;
  settings.strobe = !!preset.stb;
  settings.autoGain = !!preset.agc;
  if (isNumber(preset.gain)) settings.gain = clamp(preset.gain, 0, 100);
  if (isNumber(preset.react)) settings.reactivity = clamp(preset.react, 0.5, 3);
  notify();
}

function importPreset(preset) {
  const name = String(preset.name || 'Preset').slice(0, NAME_LIMIT);
  return { ...createPreset(name, 0, 1), ...preset, name };
}

export function importFolders(data) {
  if (!Array.isArray(data.folders)) throw new Error('Not a preset library');
  migrateLegacyPalettes(data);
  let count = 0;
  for (const folder of data.folders) {
    if (!folder || !Array.isArray(folder.presets)) continue;
    library.folders.push({
      name: String(folder.name || 'Imported').slice(0, NAME_LIMIT),
      presets: folder.presets.filter((preset) => preset && typeof preset === 'object').map(importPreset),
    });
    count++;
  }
  return count;
}

const cleanName = (name, fallback) => (String(name ?? '').trim() || fallback).slice(0, NAME_LIMIT);

export function selectFolder(index) {
  library.cur = Math.min(Math.max(0, index), library.folders.length - 1);
  playlist.selected = playlist.index = -1;
  saveLibrary();
}

export function createFolder(name) {
  library.folders.push({ name: cleanName(name, `Folder ${library.folders.length + 1}`), presets: [] });
  selectFolder(library.folders.length - 1);
}

export function renameFolder(name) {
  currentFolder().name = cleanName(name, currentFolder().name);
  saveLibrary();
}

export function deleteFolder() {
  library.folders.splice(library.cur, 1);
  if (!library.folders.length) library.folders.push({ name: 'My set', presets: [] });
  playlist.playing = false;
  selectFolder(0);
}

export const defaultPresetName = () => `${MODES[settings.mode].name} · ${PALETTES[settings.palette].name}`;

export function savePreset(name) {
  const folder = currentFolder();
  const preset = snapshot(cleanName(name, defaultPresetName()));
  folder.presets.push(preset);
  playlist.selected = folder.presets.length - 1;
  saveLibrary();
  return preset;
}

export function movePreset(index, step) {
  const { presets } = currentFolder();
  const target = index + step;
  if (target < 0 || target >= presets.length) return;
  [presets[index], presets[target]] = [presets[target], presets[index]];
  if (playlist.selected === index) playlist.selected = target;
  else if (playlist.selected === target) playlist.selected = index;
  saveLibrary();
}

export function overwritePreset(index) {
  const { presets } = currentFolder();
  presets[index] = snapshot(presets[index].name);
  saveLibrary();
}

export function deletePreset(index) {
  currentFolder().presets.splice(index, 1);
  if (playlist.selected === index) playlist.selected = -1;
  else if (playlist.selected > index) playlist.selected--;
  playlist.index = playlist.selected;
  saveLibrary();
}

export function exportLibrary() {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(library, null, 1)], { type: 'application/json' }));
  link.download = 'visualizer-presets.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

export async function importLibraryFile(file) {
  const count = importFolders(JSON.parse(await file.text()));
  selectFolder(library.folders.length - 1);
  return count;
}

export function describePreset(preset) {
  const parts = [MODES[preset.mode]?.name || '?', PALETTES[preset.pal]?.name || '?'];
  if (preset.psy) parts.push(PSY_NAMES[preset.psy]);
  if (preset.kal) parts.push(MIRROR_NAMES[preset.kal]);
  return parts.join(' · ');
}
