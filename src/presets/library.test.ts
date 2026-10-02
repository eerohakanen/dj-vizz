import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MODES } from '../modes/index';
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
vi.mock('../modes/index', () => ({ MODES: Array.from({ length: 21 }, (_, index) => ({ name: `Mode ${index}`, threeD: index >= 9 && index <= 11 })) }));
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
    expect(migrated?.version).toBe(11);
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

  it('shifts modes past the removed one for v6 libraries', () => {
    const presets = [9, 10, 11].map((mode) => createPreset('Old', mode, 1));
    const migrated = migrateLibrary({ version: 6, cur: 0, folders: [{ name: 'Mine', presets }] });
    expect(migrated?.folders[0].presets.map((preset) => preset.mode)).toEqual([9, 9, 10]);
    const current = migrateLibrary({ version: 7, cur: 0, folders: [{ name: 'Mine', presets }] });
    expect(current?.folders[0].presets.map((preset) => preset.mode)).toEqual([9, 10, 11]);
  });

  it('drops tuning stored in v5 scenes', () => {
    const preset = { ...createPreset('Current', 0, 1), tuning: { motion: 0.6 } };
    const migrated = migrateLibrary({ version: 5, cur: 0, folders: [{ name: 'Mine', presets: [preset] }] });
    expect(migrated?.folders[0].presets[0]).not.toHaveProperty('tuning');
  });

  it('accepts an empty library but rejects non-arrays', () => {
    expect(migrateLibrary({ version: 5, cur: 3, folders: [] })).toEqual({ version: 11, cur: 0, folders: [] });
    expect(migrateLibrary({ version: 2 })).toBeNull();
    expect(migrateLibrary({ version: 2, folders: 'x' })).toBeNull();
    expect(migrateLibrary('nope')).toBeNull();
  });

  it('replaces the old Default folder with the starter sets in place for v7 libraries', () => {
    const mine = { name: 'Mine', presets: [createPreset('Kept', 2, 5)] };
    const migrated = migrateLibrary({ version: 7, cur: 2, folders: [mine, { name: 'Default', presets: [] }, { name: 'Last', presets: [] }] });
    expect(migrated?.folders.map((folder) => folder.name)).toEqual(['Mine', 'Pixelated 2D', '2D · Spectrum', '2D · Flight', '2D · Patterns', 'ASCII', '3D', 'Last']);
    expect(migrated?.folders[0].presets).toEqual(mine.presets);
    expect(migrated?.cur).toBe(7);
    expect(migrateLibrary({ version: 7, cur: 1, folders: [mine, { name: 'Default', presets: [] }] })?.cur).toBe(1);
  });

  it('keeps a Default folder saved by v8', () => {
    const migrated = migrateLibrary({ version: 8, cur: 0, folders: [{ name: 'Default', presets: [] }] });
    expect(migrated?.folders.map((folder) => folder.name)).toEqual(['Default']);
  });

  it('splits the v8 and v9 2D folder into themed folders and keeps custom scenes', () => {
    const custom = createPreset('My look', 2, 4);
    const starter = createPreset('Blob · Ice', 7, 6);
    const pixelated = { name: 'Pixelated 2D', presets: [createPreset('Pixel bars', 0, 1, { pixelate: 1 }), createPreset('ASCII galaxy', 4, 3, { pixelate: 4 })] };
    const migrated = migrateLibrary({ version: 9, cur: 2, folders: [pixelated, { name: '2D', presets: [starter, custom] }, { name: 'Last', presets: [] }] })!;
    expect(migrated.folders.map((folder) => folder.name)).toEqual(['Pixelated 2D', '2D · Spectrum', '2D · Flight', '2D · Patterns', 'ASCII', '2D · Mine', 'Last']);
    expect(migrated.folders[0].presets.map((preset) => preset.name)).toEqual(['Pixel bars']);
    expect(migrated.folders[5].presets).toEqual([custom]);
    expect(migrated.cur).toBe(6);
  });

  it('leaves v8 pixelated scenes alone and adds no leftover folder without custom scenes', () => {
    const pixelated = { name: 'Pixelated 2D', presets: [createPreset('ASCII galaxy', 4, 3, { pixelate: 4 })] };
    const migrated = migrateLibrary({ version: 8, cur: 0, folders: [pixelated, { name: '2D', presets: [createPreset('Blob · Ice', 7, 6)] }] })!;
    expect(migrated.folders[0].presets).toHaveLength(1);
    expect(migrated.folders.map((folder) => folder.name)).not.toContain('2D · Mine');
    expect(migrateLibrary(migrated)!.folders).toEqual(migrated.folders);
  });

  it('flags v10 starter folders by name and leaves custom ones unflagged', () => {
    const names = ['Pixelated 2D', '2D · Mine', 'Mine', '3D'];
    const migrated = migrateLibrary({ version: 10, cur: 0, folders: names.map((name) => ({ name, presets: [] })) })!;
    expect(migrated.folders.map((folder) => !!folder.starter)).toEqual([true, false, false, true]);
    expect(migrateLibrary(migrated)!.folders).toEqual(migrated.folders);
  });

  it('keeps a renamed starter flagged once stored as v11', () => {
    const migrated = migrateLibrary({ version: 11, cur: 0, folders: [{ name: 'Renamed', presets: [], starter: true }] })!;
    expect(migrated.folders[0].starter).toBe(true);
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

  it('treats imported folders as the user\'s own', () => {
    const before = library.folders.length;
    importFolders({ version: 11, folders: [{ name: 'Shared', presets: [], starter: true }] });
    expect(library.folders.at(-1)).not.toHaveProperty('starter');
    library.folders.length = before;
  });

  it('throws on something that is not a library', () => {
    expect(() => importFolders({})).toThrow('Not a preset library');
  });
});

describe('starter presets', () => {
  const starters = () => migrateLibrary({ version: 7, cur: 0, folders: [{ name: 'Default', presets: [] }] })!.folders;
  const starterSet = (name: string) => starters().find((folder) => folder.name === name)!.presets;

  it('carry no tuning or calibration', () => {
    for (const preset of starters().flatMap((folder) => folder.presets)) {
      expect(preset).not.toHaveProperty('tuning');
      expect(preset).not.toHaveProperty('gain');
    }
  });

  it('pixelate every Pixelated 2D preset on a 2D mode', () => {
    for (const preset of starterSet('Pixelated 2D')) {
      expect(preset.pixelate).toBeGreaterThan(0);
      expect(MODES[preset.mode].threeD).toBe(false);
    }
  });

  it('keep themed 2D presets unpixelated on 2D modes', () => {
    for (const preset of ['2D · Spectrum', '2D · Flight', '2D · Patterns'].flatMap(starterSet)) {
      expect(preset.pixelate).toBe(0);
      expect(MODES[preset.mode].threeD).toBe(false);
    }
  });

  it('keep ASCII presets on 2D modes', () => {
    for (const preset of starterSet('ASCII')) expect(MODES[preset.mode].threeD).toBe(false);
  });

  it('use every mode at least once', () => {
    const used = new Set(starters().flatMap((folder) => folder.presets.map((preset) => preset.mode)));
    expect(used.size).toBe(MODES.length);
  });

  it('give each 3D mode exactly one 3D preset', () => {
    const modes = starterSet('3D').map((preset) => preset.mode);
    expect(modes.every((mode) => MODES[mode].threeD)).toBe(true);
    expect(new Set(modes).size).toBe(modes.length);
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
    applyPreset(createPreset('Blocky', 0, 0, { pixelate: 6 }));
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

  it('starts with the starter sets when nothing is stored', async () => {
    const fresh = await load([]);
    expect(fresh.library.folders.map((folder) => folder.name)).toEqual(['Pixelated 2D', '2D · Spectrum', '2D · Flight', '2D · Patterns', 'ASCII', '3D']);
    expect(fresh.library.folders.every((folder) => folder.starter)).toBe(true);
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
