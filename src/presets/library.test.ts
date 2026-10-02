import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settings, TUNING_DEFAULTS } from '../state';
import {
  addScene,
  applyPreset,
  createFolder,
  createPreset,
  currentFolder,
  deleteFolder,
  deletePreset,
  describePreset,
  duplicateScene,
  importFolders,
  movePreset,
  library,
  migrateLibrary,
  readLegacyTuning,
  NAME_LIMIT,
  playlist,
  type Preset,
  renameFolder,
  renameScene,
  restorePreset,
  snapshot,
} from './library';

vi.mock('../canvas', () => ({ output: {}, transitionCtx: {}, transitionFrame: {} }));
vi.mock('../modes/index', () => ({ MODES: Array.from({ length: 12 }, (_, index) => ({ name: `Mode ${index}` })) }));
vi.mock('../mode', async () => {
  const { settings } = await import('../state');
  return { setMode: vi.fn((index: number) => (settings.mode = index)) };
});
vi.mock('../color', async () => {
  const { settings } = await import('../state');
  return { setPalette: vi.fn((index: number) => (settings.palette = index)) };
});

const legacyPreset = {
  name: 'Old look',
  mode: 3,
  pal: 4,
  psy: 1,
  kal: 2,
  fb: false,
  las: true,
  gl: false,
  stb: true,
  gain: 80,
  agc: false,
  react: 0.4,
  tuning: { motion: 1.5, noiseGate: 0.1, beatSensitivity: 1.8, dropSensitivity: 0.2 },
};

const legacyLibrary = (version: number) => ({ version, cur: 0, folders: [{ name: 'Old', presets: [legacyPreset] }] });

const calibration = { gain: 12, autoGain: false, noiseGate: 0.1, beatSensitivity: 1.7, dropSensitivity: 0.3 };

const defaultLook = { mode: 0, palette: 1, psy: 0, mirror: 0, pixelate: 0, lasers: false };

beforeEach(() => {
  Object.assign(settings, TUNING_DEFAULTS, defaultLook);
});

describe('migrateLibrary', () => {
  it('maps v2 short keys into the v3 shape and drops calibration', () => {
    const migrated = migrateLibrary(legacyLibrary(2));
    expect(migrated?.version).toBe(6);
    expect(migrated?.folders[0].presets[0]).toEqual({
      name: 'Old look',
      mode: 3,
      palette: 4,
      mirror: 2,
      psy: 1,
      pixelate: 0,
      effects: { lasers: true },
    });
  });

  it('shifts palettes past the removed one for v1 libraries', () => {
    expect(migrateLibrary(legacyLibrary(1))?.folders[0].presets[0].palette).toBe(3);
  });

  it('keeps v3 presets and gives folders playback defaults', () => {
    const preset = createPreset('Kept', 2, 5, { mirror: 1, effects: { lasers: true } });
    const migrated = migrateLibrary({ version: 3, cur: 0, folders: [{ name: 'Mine', presets: [preset] }] });
    expect(migrated?.folders[0].presets[0]).toEqual(preset);
    expect(migrated?.folders[0]).toMatchObject({ transition: 'random', changeOn: 'b32', shuffle: false });
  });

  it('keeps valid folder playback fields and replaces invalid ones', () => {
    const migrated = migrateLibrary({
      version: 4,
      cur: 0,
      folders: [
        { name: 'Good', presets: [], transition: 'cut', changeOn: 's15', shuffle: true },
        { name: 'Bad', presets: [], transition: 'wipe', changeOn: 'b7', shuffle: 'yes' },
      ],
    });
    expect(migrated?.folders[0]).toMatchObject({ transition: 'cut', changeOn: 's15', shuffle: true });
    expect(migrated?.folders[1]).toMatchObject({ transition: 'random', changeOn: 'b32', shuffle: false });
  });

  it('drops tuning stored in v5 scenes', () => {
    const preset = { ...createPreset('Current', 0, 1), tuning: { motion: 0.6 } };
    const migrated = migrateLibrary({ version: 5, cur: 0, folders: [{ name: 'Mine', presets: [preset] }] });
    expect(migrated?.folders[0].presets[0]).not.toHaveProperty('tuning');
  });

  it('accepts an empty library but rejects non-arrays', () => {
    expect(migrateLibrary({ version: 5, cur: 3, folders: [] })).toEqual({ version: 6, cur: 0, folders: [] });
    expect(migrateLibrary({ version: 2 })).toBeNull();
    expect(migrateLibrary({ version: 2, folders: 'x' })).toBeNull();
    expect(migrateLibrary('nope')).toBeNull();
  });
});

describe('readLegacyTuning', () => {
  it('rescales intensity from v4 so the old 0.2 becomes the new default', () => {
    expect(readLegacyTuning({ tuning: { reactivity: 0.2, motion: 1.4 } }, 4)).toEqual({ reactivity: 1, motion: 1.4 });
  });

  it('reads the v2 react key and leaves v5 intensity alone', () => {
    expect(readLegacyTuning(legacyPreset, 2)).toMatchObject({ reactivity: 2, motion: 1.5 });
    expect(readLegacyTuning({ tuning: { reactivity: 0.6, motion: 'fast' } }, 5)).toEqual({ reactivity: 0.6 });
  });
});

describe('importFolders', () => {
  it('runs old exported files through the migration', () => {
    const before = library.folders.length;
    expect(importFolders(legacyLibrary(2))).toBe(1);
    const imported = library.folders.at(-1)!.presets[0];
    expect(imported.palette).toBe(4);
    expect(imported).not.toHaveProperty('gain');
    expect(imported).not.toHaveProperty('agc');
    library.folders.length = before;
  });

  it('throws on something that is not a library', () => {
    expect(() => importFolders({})).toThrow('Not a preset library');
  });
});

describe('starter presets', () => {
  it('carry no tuning or calibration', () => {
    for (const preset of library.folders[0].presets) {
      expect(preset).not.toHaveProperty('tuning');
      expect(preset).not.toHaveProperty('gain');
    }
  });
});

describe('applyPreset', () => {
  it('leaves calibration and tuning untouched', () => {
    Object.assign(settings, calibration, { reactivity: 0.5, motion: 1.8 });
    applyPreset(migrateLibrary(legacyLibrary(2))!.folders[0].presets[0]);
    expect(settings).toMatchObject(calibration);
    expect(settings).toMatchObject({ mode: 3, palette: 4, mirror: 2, psy: 1, lasers: true });
    expect(settings).toMatchObject({ reactivity: 0.5, motion: 1.8 });
  });

  it('wraps the pixel shape', () => {
    applyPreset(createPreset('Blocky', 0, 0, { pixelate: 5 }));
    expect(settings.pixelate).toBe(1);
  });

  it('turns pixelate off for presets saved before it existed', () => {
    settings.pixelate = 2;
    applyPreset(migrateLibrary(legacyLibrary(2))!.folders[0].presets[0]);
    expect(settings.pixelate).toBe(0);
  });

  it('round-trips a snapshot', () => {
    const look = {
      mode: 7,
      palette: 9,
      mirror: 3,
      psy: 4,
      pixelate: 2,
      lasers: true,
    };
    Object.assign(settings, look);
    const preset = snapshot('Round trip');
    Object.assign(settings, TUNING_DEFAULTS, defaultLook);
    applyPreset(preset);
    expect(settings).toMatchObject(look);
    expect(snapshot('Round trip')).toEqual(preset);
  });
});

describe('stored library', () => {
  it('loads a v2 library from the old key when v4 is missing', async () => {
    const stored = new Map([['djviz.presets.v2', JSON.stringify(legacyLibrary(2))]]);
    vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: vi.fn() });
    vi.resetModules();
    const fresh = await import('./library');
    expect(fresh.library.folders[0].presets[0].palette).toBe(4);
    expect(fresh.library.folders[0].presets[0]).not.toHaveProperty('gain');
    vi.unstubAllGlobals();
  });
});

describe('stored v3 and v4 libraries', () => {
  const load = async (entries: [string, unknown][]) => {
    const stored = new Map(entries.map(([key, value]) => [key, JSON.stringify(value)]));
    vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: vi.fn() });
    vi.resetModules();
    const fresh = await import('./library');
    vi.unstubAllGlobals();
    return fresh;
  };

  it('loads a v3 library when v4 is missing', async () => {
    const preset = createPreset('Kept', 2, 5);
    const fresh = await load([['djviz.presets.v3', { version: 3, cur: 0, folders: [{ name: 'Mine', presets: [preset] }] }]]);
    expect(fresh.library.folders[0]).toMatchObject({ name: 'Mine', transition: 'random', shuffle: false });
    expect(fresh.library.folders[0].presets[0]).toEqual(preset);
  });

  it('keeps a deleted Default deleted after reload', async () => {
    const fresh = await load([['djviz.presets.v4', { version: 4, cur: 0, folders: [] }]]);
    expect(fresh.library.folders).toEqual([]);
    expect(fresh.currentFolder()).toBeUndefined();
  });

  it('starts with a Default preset when nothing is stored', async () => {
    const fresh = await load([]);
    expect(fresh.library.folders.map((folder) => folder.name)).toEqual(['Default']);
  });
});

const resetFolders = (presets: Preset[] = []) => {
  library.cur = 0;
  library.folders.splice(0, library.folders.length, {
    name: 'Default',
    presets,
    transition: 'random',
    changeOn: 'b32',
    shuffle: false,
  });
};

describe('folder management', () => {
  beforeEach(() => {
    resetFolders();
    playlist.playing = false;
  });

  it('creates folders with a default name and returns the index', () => {
    const index = createFolder();
    expect(index).toBe(1);
    expect(library.cur).toBe(1);
    expect(currentFolder()).toMatchObject({ name: 'Preset 1', transition: 'random', changeOn: 'b32', shuffle: false });
  });

  it('picks the first unused default name', () => {
    createFolder('Preset 1');
    createFolder('Preset 3');
    createFolder();
    createFolder();
    expect(library.folders.map((folder) => folder.name)).toEqual(['Default', 'Preset 1', 'Preset 3', 'Preset 2', 'Preset 4']);
  });

  it('renames a given folder', () => {
    createFolder('Two');
    renameFolder('Renamed', 0);
    expect(library.folders.map((folder) => folder.name)).toEqual(['Renamed', 'Two']);
  });

  it('deletes without recreating anything and stops playback', () => {
    playlist.playing = true;
    const removed = deleteFolder(0);
    expect(removed?.name).toBe('Default');
    expect(library.folders).toEqual([]);
    expect(library.cur).toBe(0);
    expect(currentFolder()).toBeUndefined();
    expect(playlist.playing).toBe(false);
    expect(deleteFolder()).toBeUndefined();
  });

  it('keeps the same folder current when an earlier one is deleted', () => {
    createFolder('Two');
    createFolder('Three');
    deleteFolder(0);
    expect(currentFolder()?.name).toBe('Three');
  });
});

describe('scenes', () => {
  beforeEach(() => resetFolders(['a', 'b'].map((name) => snapshot(name))));

  it('adds a snapshot of the current settings and selects it', () => {
    settings.mode = 5;
    const index = addScene();
    expect(index).toBe(2);
    expect(playlist.selected).toBe(2);
    expect(currentFolder()?.presets[2]).toMatchObject({ mode: 5 });
    expect(currentFolder()?.presets[2].name).toMatch(/^Mode 5 · /);
  });

  it('duplicates a scene right after the original', () => {
    const index = duplicateScene(0);
    const names = currentFolder()!.presets.map((preset) => preset.name);
    expect(index).toBe(1);
    expect(names).toEqual(['a', 'a copy', 'b']);
    expect(playlist.selected).toBe(1);
    expect(currentFolder()!.presets[1]).not.toBe(currentFolder()!.presets[0]);
  });

  it('truncates long duplicate names to the limit', () => {
    currentFolder()!.presets[0].name = 'x'.repeat(NAME_LIMIT);
    duplicateScene(0);
    expect(currentFolder()!.presets[1].name).toHaveLength(NAME_LIMIT);
  });

  it('ignores a missing scene', () => {
    expect(duplicateScene(9)).toBe(-1);
  });

  it('renames a scene, keeping the old name when the new one is blank', () => {
    renameScene(1, '  Intro  ');
    renameScene(0, '   ');
    renameScene(9, 'missing');
    expect(currentFolder()!.presets.map((preset) => preset.name)).toEqual(['a', 'Intro']);
  });
});

describe('restorePreset', () => {
  const names = () => library.folders[library.cur].presets.map((preset) => preset.name);

  beforeEach(() => resetFolders(['a', 'b', 'c', 'd'].map((name) => snapshot(name))));

  it('puts a deleted preset back at its old index', () => {
    const removed = deletePreset(1);
    expect(names()).toEqual(['a', 'c', 'd']);
    restorePreset(removed, 1, library.folders[0]);
    expect(names()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('clamps an index past the end', () => {
    const removed = deletePreset(3);
    deletePreset(2);
    restorePreset(removed, 3, library.folders[0]);
    expect(names()).toEqual(['a', 'b', 'd']);
  });

  it('keeps the selected preset selected', () => {
    playlist.selected = 2;
    const removed = deletePreset(0);
    expect(playlist.selected).toBe(1);
    restorePreset(removed, 0, library.folders[0]);
    expect(playlist.selected).toBe(2);
  });
});

describe('scene selection', () => {
  beforeEach(() => {
    resetFolders(['a', 'b', 'c'].map((name) => snapshot(name)));
    playlist.selected = playlist.index = 0;
  });

  it('steps from a newly added scene', () => {
    addScene();
    expect(playlist.index).toBe(3);
  });

  it('steps from a duplicated scene', () => {
    duplicateScene(1);
    expect(playlist.index).toBe(2);
  });

  it('moves the selected and current positions with their scenes', () => {
    movePreset(0, 1);
    expect([playlist.selected, playlist.index]).toEqual([1, 1]);
    playlist.selected = playlist.index = 2;
    movePreset(1, 1);
    expect([playlist.selected, playlist.index]).toEqual([1, 1]);
  });
});

describe('describePreset', () => {
  it('names the pixel shape when pixelate is on', () => {
    expect(describePreset(createPreset('Dots', 2, 3, { pixelate: 2 }))).toBe('Mode 2 · Ocean · Round pixels');
    expect(describePreset(createPreset('Plain', 2, 3))).not.toContain('pixels');
  });
});
