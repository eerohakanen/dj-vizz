import { setPalette } from '../color';
import { DEFAULT_CHANGE_ON, findChangeOption, type ChangeOn } from './change';
import { DEFAULT_TRANSITION, findTransition, type TransitionKind } from '../effects/transition';
import { setMode } from '../mode';
import { isNumber, isRecord } from '../lib/utils';
import { clamp, wrap } from '../math';
import { MODES } from '../modes/index';
import { PALETTES } from '../palettes';
import { INTENSITY_SCALE, settings } from '../state';
import { notify } from '../store';
import type { TuningKey } from '../tuning';
import { MIRROR_NAMES, mirrorIndex, PIXEL_NAMES, pixelIndex, PSY_NAMES, psyIndex } from '../effects/options';

const STORAGE_KEY = 'djviz.presets.v4';
const LEGACY_STORAGE_KEYS = ['djviz.presets.v3', 'djviz.presets.v2', 'djviz.presets.v1'];
export const LIBRARY_VERSION = 8;
const INTENSITY_SCALE_VERSION = 5;
const SCENE_SHAPE_VERSION = 3;
const PALETTE_SHIFT_VERSION = 2;
const MODE_SHIFT_VERSION = 7;
const STARTER_SETS_VERSION = 8;
const REPLACED_STARTER_NAME = 'Default';
export const NAME_LIMIT = 40;

export interface PresetEffects {
  lasers: boolean;
}

export interface Preset {
  name: string;
  mode: number;
  palette: number;
  mirror: number;
  psy: number;
  pixelate: number;
  effects: PresetEffects;
}

export interface Folder {
  name: string;
  presets: Preset[];
  transition: TransitionKind;
  changeOn: ChangeOn;
  shuffle: boolean;
}

interface Library {
  version: number;
  cur: number;
  folders: Folder[];
}

const EFFECT_KEYS = ['lasers'] as const;

type EffectKey = (typeof EFFECT_KEYS)[number];

const LEGACY_EFFECT_KEYS: Record<keyof PresetEffects, string> = { lasers: 'las' };

const DEFAULT_EFFECTS: PresetEffects = { lasers: false };

const effectFlags = (read: (key: EffectKey) => boolean): PresetEffects =>
  Object.fromEntries(EFFECT_KEYS.map((key) => [key, read(key)])) as Record<EffectKey, boolean>;

export const createPreset = (
  name: string,
  mode: number,
  palette: number,
  overrides?: Partial<Omit<Preset, 'effects'>> & { effects?: Partial<PresetEffects> },
): Preset => ({
  name,
  mode,
  palette,
  mirror: 0,
  psy: 0,
  pixelate: 0,
  ...overrides,
  effects: { ...DEFAULT_EFFECTS, ...overrides?.effects },
});

const starterFolder = (name: string, presets: Preset[]): Folder => ({
  name,
  transition: DEFAULT_TRANSITION,
  changeOn: DEFAULT_CHANGE_ON,
  shuffle: false,
  presets,
});

const starterFolders = (): Folder[] => [
  starterFolder('Pixelated 2D', [
    createPreset('Pixel bars', 0, 1, { pixelate: pixelIndex('Square') }),
    createPreset('Diamond hex', 8, 11, { pixelate: pixelIndex('Diamond') }),
    createPreset('8-bit grid', 5, 7, { pixelate: pixelIndex('Square') }),
    createPreset('Dotted laser tunnel', 2, 4, { pixelate: pixelIndex('Round'), effects: { lasers: true } }),
    createPreset('Bead galaxy', 4, 9, { pixelate: pixelIndex('Round') }),
    createPreset('Pixel scope', 3, 8, { pixelate: pixelIndex('Square') }),
  ]),
  starterFolder('2D', [
    createPreset('Warp · Fire', 6, 5),
    createPreset('Radial vortex', 1, 7, { psy: psyIndex('Vortex') }),
    createPreset('Kaleido galaxy', 4, 1, { mirror: mirrorIndex('Kaleido') }),
    createPreset('Laser tunnel', 2, 11, { effects: { lasers: true } }),
    createPreset('Liquid bars', 0, 2, { psy: psyIndex('Liquid') }),
    createPreset('Rainbow hex', 8, 0, { psy: psyIndex('Rainbow') }),
    createPreset('Blob · Ice', 7, 6),
  ]),
  starterFolder('3D', [
    createPreset('Deep Space · Ice', 9, 6),
    createPreset('Model · Neon', 10, 1),
    createPreset('Solar System · Fire', 11, 5),
  ]),
];

const starterLibrary = (): Library => ({
  version: LIBRARY_VERSION,
  cur: 0,
  folders: starterFolders(),
});

function replaceStarterFolders(folders: Folder[], cur: number) {
  const groups = folders.map((folder) => (folder.name === REPLACED_STARTER_NAME ? starterFolders() : [folder]));
  return { folders: groups.flat(), cur: groups.slice(0, cur).reduce((total, group) => total + group.length, 0) };
}

const REMOVED_PALETTE = 1;
const REMOVED_MODE = 9;

const numberOr = (value: unknown, fallback: number) => (isNumber(value) ? value : fallback);

function migratePreset(raw: Record<string, unknown>, version: number): Preset {
  const legacy = version < SCENE_SHAPE_VERSION;
  let palette = numberOr(legacy ? raw.pal : raw.palette, 1);
  if (version < PALETTE_SHIFT_VERSION && palette > REMOVED_PALETTE) palette--;
  let mode = numberOr(raw.mode, 0);
  if (version < MODE_SHIFT_VERSION && mode > REMOVED_MODE) mode--;
  const effectSource = legacy ? raw : isRecord(raw.effects) ? raw.effects : {};
  const effect = (key: EffectKey) => {
    const value = effectSource[legacy ? LEGACY_EFFECT_KEYS[key] : key];
    return typeof value === 'boolean' ? value : DEFAULT_EFFECTS[key];
  };
  return {
    name: String(raw.name || 'Preset').slice(0, NAME_LIMIT),
    mode,
    palette,
    mirror: numberOr(legacy ? raw.kal : raw.mirror, 0),
    psy: numberOr(raw.psy, 0),
    pixelate: numberOr(raw.pixelate, 0),
    effects: effectFlags(effect),
  };
}

export const readPreset = (raw: Record<string, unknown>, version = LIBRARY_VERSION) => migratePreset(raw, version);

export function readLegacyTuning(raw: Record<string, unknown>, version = LIBRARY_VERSION): Partial<Record<TuningKey, number>> {
  const tuning: Record<string, unknown> = isRecord(raw.tuning) ? { ...raw.tuning } : {};
  if (version < SCENE_SHAPE_VERSION && isNumber(raw.react)) tuning.reactivity = raw.react;
  if (version < INTENSITY_SCALE_VERSION && isNumber(tuning.reactivity)) tuning.reactivity /= INTENSITY_SCALE;
  return Object.fromEntries(Object.entries(tuning).filter((entry): entry is [TuningKey, number] => isNumber(entry[1])));
}

function migrateFolders(data: Record<string, unknown>): Folder[] {
  if (!Array.isArray(data.folders)) throw new Error('Not a preset library');
  const version = numberOr(data.version, 1);
  return data.folders
    .filter((folder): folder is Record<string, unknown> & { presets: unknown[] } => isRecord(folder) && Array.isArray(folder.presets))
    .map((folder) => ({
      name: String(folder.name || 'Imported').slice(0, NAME_LIMIT),
      presets: folder.presets.filter(isRecord).map((preset) => migratePreset(preset, version)),
      transition: findTransition(folder.transition)?.value ?? DEFAULT_TRANSITION,
      changeOn: findChangeOption(folder.changeOn)?.value ?? DEFAULT_CHANGE_ON,
      shuffle: folder.shuffle === true,
    }));
}

export function migrateLibrary(data: unknown): Library | null {
  if (!isRecord(data)) return null;
  try {
    const folders = migrateFolders(data);
    const cur = clamp(numberOr(data.cur, 0) | 0, 0, Math.max(0, folders.length - 1));
    const current = numberOr(data.version, 1) < STARTER_SETS_VERSION ? replaceStarterFolders(folders, cur) : { folders, cur };
    return { version: LIBRARY_VERSION, ...current };
  } catch {
    return null;
  }
}

function readStored(key: string) {
  try {
    return migrateLibrary(JSON.parse(localStorage.getItem(key) ?? 'null'));
  } catch {
    return null;
  }
}

function loadLibrary() {
  for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
    const stored = readStored(key);
    if (stored) return stored;
  }
  return starterLibrary();
}

export const library = loadLibrary();

export const playlist = {
  playing: false,
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

export const currentFolder = (): Folder | undefined => library.folders[library.cur];

type Look = Pick<typeof settings, 'mode' | 'palette' | 'psy' | 'mirror' | 'pixelate' | keyof PresetEffects>;

const presetFromLook = (name: string, look: Look): Preset => ({
  name,
  mode: look.mode,
  palette: look.palette,
  mirror: look.mirror,
  psy: look.psy,
  pixelate: look.pixelate,
  effects: effectFlags((key) => look[key]),
});

export const snapshot = (name: string) => presetFromLook(name, settings);

export function resolveLook(preset: Preset): Look {
  return {
    mode: wrap(numberOr(preset.mode, settings.mode), MODES.length),
    palette: wrap(numberOr(preset.palette, settings.palette), PALETTES.length),
    psy: wrap(numberOr(preset.psy, 0), PSY_NAMES.length),
    mirror: wrap(numberOr(preset.mirror, 0), MIRROR_NAMES.length),
    pixelate: wrap(numberOr(preset.pixelate, 0), PIXEL_NAMES.length),
    ...Object.fromEntries(EFFECT_KEYS.map((key) => [key, !!preset.effects?.[key]])),
  } as Look;
}

export const normalizePreset = (preset: Preset) => presetFromLook(preset.name, resolveLook(preset));

export function applyPreset(preset: Preset | undefined, transition?: TransitionKind) {
  if (!preset) return;
  const { mode, palette, ...look } = resolveLook(preset);
  setMode(mode, transition);
  if (palette !== settings.palette) setPalette(palette, true);
  Object.assign(settings, look);
  notify();
}

export function importFolders(data: unknown) {
  if (!isRecord(data)) throw new Error('Not a preset library');
  const folders = migrateFolders(data);
  library.folders.push(...folders);
  return folders.length;
}

const cleanName = (name: string | null | undefined, fallback: string) => (String(name ?? '').trim() || fallback).slice(0, NAME_LIMIT);

export function selectFolder(index: number) {
  library.cur = clamp(index, 0, Math.max(0, library.folders.length - 1));
  playlist.selected = playlist.index = -1;
  saveLibrary();
}

function unusedFolderName() {
  const taken = new Set(library.folders.map((folder) => folder.name));
  let number = 1;
  while (taken.has(`Preset ${number}`)) number++;
  return `Preset ${number}`;
}

export function createFolder(name?: string) {
  library.folders.push({
    name: cleanName(name, unusedFolderName()),
    presets: [],
    transition: DEFAULT_TRANSITION,
    changeOn: DEFAULT_CHANGE_ON,
    shuffle: false,
  });
  const index = library.folders.length - 1;
  selectFolder(index);
  return index;
}

export function renameFolder(name?: string, index = library.cur) {
  const folder = library.folders[index];
  if (!folder) return;
  folder.name = cleanName(name, folder.name);
  saveLibrary();
}

export function deleteFolder(index = library.cur) {
  const [removed] = library.folders.splice(index, 1);
  if (!removed) return undefined;
  playlist.playing = false;
  selectFolder(index < library.cur ? library.cur - 1 : library.cur);
  return removed;
}

export const defaultPresetName = () => `${MODES[settings.mode].name} · ${PALETTES[settings.palette].name}`;

export function savePreset(name?: string) {
  const folder = currentFolder() ?? library.folders[createFolder()];
  const preset = snapshot(cleanName(name, defaultPresetName()));
  folder.presets.push(preset);
  playlist.selected = playlist.index = folder.presets.length - 1;
  saveLibrary();
  return preset;
}

export function addScene() {
  savePreset();
  return playlist.selected;
}

export function duplicateScene(index: number) {
  const folder = currentFolder();
  const source = folder?.presets[index];
  if (!folder || !source) return -1;
  const copy = structuredClone({ ...source, name: cleanName(`${source.name} copy`, source.name) });
  folder.presets.splice(index + 1, 0, copy);
  playlist.selected = playlist.index = index + 1;
  saveLibrary();
  return index + 1;
}

export function renameScene(index: number, name?: string) {
  const scene = currentFolder()?.presets[index];
  if (!scene) return;
  scene.name = cleanName(name, scene.name);
  saveLibrary();
}

export function movePreset(index: number, step: number) {
  const presets = currentFolder()?.presets;
  const target = index + step;
  if (!presets || target < 0 || target >= presets.length) return;
  [presets[index], presets[target]] = [presets[target], presets[index]];
  const follow = (position: number) => (position === index ? target : position === target ? index : position);
  playlist.selected = follow(playlist.selected);
  playlist.index = follow(playlist.index);
  saveLibrary();
}

export function overwritePreset(index: number) {
  const presets = currentFolder()?.presets;
  if (!presets?.[index]) return;
  presets[index] = snapshot(presets[index].name);
  saveLibrary();
}

export function deletePreset(index: number) {
  const [removed] = currentFolder()?.presets.splice(index, 1) ?? [];
  if (playlist.selected === index) playlist.selected = -1;
  else if (playlist.selected > index) playlist.selected--;
  playlist.index = playlist.selected;
  saveLibrary();
  return removed;
}

export function restorePreset(preset: Preset, index: number, folder: Folder) {
  const at = Math.min(Math.max(index, 0), folder.presets.length);
  folder.presets.splice(at, 0, preset);
  if (folder === currentFolder()) {
    if (playlist.selected >= at) playlist.selected++;
    playlist.index = playlist.selected;
  }
  saveLibrary();
}

export function exportLibrary() {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(library, null, 1)], { type: 'application/json' }));
  link.download = 'visualizer-presets.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

export async function importLibraryFile(file: File) {
  const count = importFolders(JSON.parse(await file.text()));
  selectFolder(library.folders.length - 1);
  return count;
}

export function describePreset(preset: Preset) {
  const parts = [MODES[preset.mode]?.name || '?', PALETTES[preset.palette]?.name || '?'];
  if (preset.psy) parts.push(PSY_NAMES[preset.psy]);
  if (preset.mirror) parts.push(MIRROR_NAMES[preset.mirror]);
  if (preset.pixelate) parts.push(`${PIXEL_NAMES[preset.pixelate]} pixels`);
  return parts.join(' · ');
}
