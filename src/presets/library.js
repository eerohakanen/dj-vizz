import { setPalette } from '../color.js';
import { setMode } from '../mode.js';
import { settings } from '../state.js';
import { MIRROR_NAMES, PSY_NAMES, syncUI } from '../ui.js';

const STORAGE_KEY = 'djviz.presets.v1';
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
  cur: 0,
  folders: [
    {
      name: 'Starter',
      presets: [
        createPreset('Warp · Fire', 6, 6),
        createPreset('Hypno vortex', 9, 8, { psy: 1 }),
        createPreset('Kaleido galaxy', 4, 2, { kal: 3 }),
        createPreset('Laser tunnel', 2, 12, { las: true }),
        createPreset('Liquid bars', 0, 3, { psy: 2 }),
        createPreset('Rainbow hex', 8, 0, { psy: 3, gl: true }),
      ],
    },
  ],
});

function loadLibrary() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {}
  const loaded = stored && Array.isArray(stored.folders) && stored.folders.length ? stored : starterLibrary();
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
  syncUI();
}

function importPreset(preset) {
  const name = String(preset.name || 'Preset').slice(0, NAME_LIMIT);
  return { ...createPreset(name, 0, 1), ...preset, name };
}

export function importFolders(data) {
  if (!Array.isArray(data.folders)) throw new Error('Not a preset library');
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
