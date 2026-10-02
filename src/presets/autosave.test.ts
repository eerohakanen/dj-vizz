import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settings, TUNING_DEFAULTS } from '../state';
import { ui } from '../store';
import { flushAutosave, startAutosave } from './autosave';
import { createPreset, currentFolder, library, playlist, snapshot, type Preset } from './library';
import { loadPreset } from './playlist';
import { setSetting } from '../actions';

vi.mock('../canvas', () => ({ output: {}, transitionCtx: {}, transitionFrame: {} }));
vi.mock('../modes/index', () => ({ MODES: Array.from({ length: 12 }, (_, index) => ({ name: `Mode ${index}` })) }));
vi.mock('../mode', async () => {
  const { settings } = await import('../state');
  return { setMode: vi.fn((index: number) => (settings.mode = index % 12)) };
});
vi.mock('../color', async () => {
  const { settings } = await import('../state');
  return { setPalette: vi.fn((index: number) => (settings.palette = index)) };
});
vi.mock('../dom', () => ({ showMessage: vi.fn() }));
vi.mock('../audio/input', () => ({ audio: { live: true }, disconnectAudio: vi.fn() }));

let stop: () => void;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  Object.assign(settings, TUNING_DEFAULTS, { mode: 0, palette: 1, psy: 0, mirror: 0, lasers: false });
  library.cur = 0;
  library.folders[0].presets = [createPreset('One', 0, 1)];
  playlist.selected = 0;
  Object.assign(ui, { screen: 'live', liveMode: 'edit' });
  stop = startAutosave();
});

afterEach(() => {
  stop();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('autosave', () => {
  it('writes the snapshot to the selected scene after the delay in edit mode', () => {
    setSetting('mirror', 2);
    expect(currentFolder()?.presets[0].mirror).toBe(0);
    vi.advanceTimersByTime(300);
    expect(currentFolder()?.presets[0]).toEqual(snapshot('One'));
    expect(currentFolder()?.presets[0].mirror).toBe(2);
  });

  it('writes nothing in play mode', () => {
    ui.liveMode = 'play';
    setSetting('mirror', 2);
    vi.advanceTimersByTime(1000);
    expect(currentFolder()?.presets[0].mirror).toBe(0);
  });

  it('flushes pending changes immediately', () => {
    setSetting('psy', 1);
    flushAutosave();
    expect(currentFolder()?.presets[0].psy).toBe(1);
  });

  it('does nothing without a selected scene', () => {
    playlist.selected = -1;
    setSetting('psy', 1);
    vi.advanceTimersByTime(1000);
    expect(currentFolder()?.presets[0].psy).toBe(0);
  });


  it('leaves out-of-range imported values untouched when a scene is only opened', () => {
    const scene: Preset = { ...createPreset('Wild', 30, 2), mirror: 9, tuning: { motion: 50 } };
    library.folders[0].presets = [createPreset('One', 0, 1), structuredClone(scene)];
    loadPreset(1);
    vi.advanceTimersByTime(1000);
    flushAutosave();
    expect(currentFolder()?.presets[1]).toEqual(scene);
  });

  it('saves the normalised look once the user changes an opened scene', () => {
    library.folders[0].presets = [createPreset('One', 0, 1), { ...createPreset('Wild', 30, 2), tuning: { motion: 50 } }];
    loadPreset(1);
    setSetting('psy', 2);
    vi.advanceTimersByTime(300);
    expect(currentFolder()?.presets[1]).toEqual(snapshot('Wild'));
    expect(currentFolder()?.presets[1]).toMatchObject({ mode: 6, psy: 2 });
  });
});
