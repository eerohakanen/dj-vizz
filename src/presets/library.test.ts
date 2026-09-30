import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settings, TUNING_DEFAULTS } from '../state';
import { applyPreset, createPreset, importFolders, library, migrateLibrary, snapshot } from './library';

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
  react: 2.2,
  tuning: { motion: 1.5, noiseGate: 0.1, beatSensitivity: 1.8, dropSensitivity: 0.2 },
};

const legacyLibrary = (version: number) => ({ version, cur: 0, folders: [{ name: 'Old', presets: [legacyPreset] }] });

const calibration = { gain: 12, autoGain: false, noiseGate: 0.1, beatSensitivity: 1.7, dropSensitivity: 0.3 };

const defaultLook = { mode: 0, palette: 1, psy: 0, mirror: 0, trails: true, lasers: false, glitch: false, strobe: false };

beforeEach(() => {
  Object.assign(settings, TUNING_DEFAULTS, defaultLook);
});

describe('migrateLibrary', () => {
  it('maps v2 short keys into the v3 shape and drops calibration', () => {
    const migrated = migrateLibrary(legacyLibrary(2));
    expect(migrated?.version).toBe(3);
    expect(migrated?.folders[0].presets[0]).toEqual({
      name: 'Old look',
      mode: 3,
      palette: 4,
      mirror: 2,
      psy: 1,
      effects: { trails: false, lasers: true, glitch: false, strobe: true },
      tuning: { reactivity: 2.2, motion: 1.5 },
    });
  });

  it('shifts palettes past the removed one for v1 libraries', () => {
    expect(migrateLibrary(legacyLibrary(1))?.folders[0].presets[0].palette).toBe(3);
  });

  it('keeps v3 presets as they are', () => {
    const preset = createPreset('Kept', 2, 5, { mirror: 1, effects: { glitch: true } });
    const migrated = migrateLibrary({ version: 3, cur: 0, folders: [{ name: 'Mine', presets: [preset] }] });
    expect(migrated?.folders[0].presets[0]).toEqual(preset);
  });

  it('rejects data without folders', () => {
    expect(migrateLibrary({ version: 2 })).toBeNull();
    expect(migrateLibrary({ version: 2, folders: [] })).toBeNull();
    expect(migrateLibrary('nope')).toBeNull();
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
  it('use the default Response tuning and carry no calibration', () => {
    for (const preset of library.folders[0].presets) {
      expect(preset.tuning.reactivity).toBe(TUNING_DEFAULTS.reactivity);
      expect(preset.tuning).not.toHaveProperty('gain');
      expect(preset).not.toHaveProperty('gain');
    }
  });
});

describe('applyPreset', () => {
  it('leaves room calibration untouched', () => {
    Object.assign(settings, calibration);
    applyPreset(migrateLibrary(legacyLibrary(2))!.folders[0].presets[0]);
    expect(settings).toMatchObject(calibration);
    expect(settings).toMatchObject({ mode: 3, palette: 4, mirror: 2, psy: 1, lasers: true, strobe: true, trails: false });
    expect(settings.reactivity).toBe(2.2);
    expect(settings.motion).toBe(1.5);
  });

  it('clamps look tuning to each control range', () => {
    applyPreset(createPreset('Wild', 0, 0, { tuning: { reactivity: 99, trailLength: 0.1, flashes: -1 } }));
    expect(settings.reactivity).toBe(3);
    expect(settings.trailLength).toBe(0.8);
    expect(settings.flashes).toBe(0);
  });

  it('resets look tuning the preset does not mention to defaults', () => {
    settings.punch = 1.9;
    applyPreset(createPreset('Sparse', 0, 0, { tuning: {} }));
    expect(settings.punch).toBe(TUNING_DEFAULTS.punch);
  });

  it('round-trips a snapshot', () => {
    const look = {
      mode: 7,
      palette: 9,
      mirror: 3,
      psy: 4,
      trails: false,
      lasers: true,
      glitch: true,
      strobe: false,
      reactivity: 2.5,
      motion: 0.4,
      punch: 1.6,
      flashes: 0.3,
      particles: 1.8,
      colorSpeed: 0.2,
      trailLength: 0.9,
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
  it('loads a v2 library from the old key when v3 is missing', async () => {
    const stored = new Map([['djviz.presets.v2', JSON.stringify(legacyLibrary(2))]]);
    vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: vi.fn() });
    vi.resetModules();
    const fresh = await import('./library');
    expect(fresh.library.folders[0].presets[0].palette).toBe(4);
    expect(fresh.library.folders[0].presets[0]).not.toHaveProperty('gain');
    vi.unstubAllGlobals();
  });
});
