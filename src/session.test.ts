import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GLOBAL_CONTROLS, MODE_CONTROLS } from './tuning';

vi.mock('./canvas', () => ({ output: {}, transitionCtx: {}, transitionFrame: {} }));
vi.mock('./modes/index', () => ({ MODES: Array.from({ length: 12 }, (_, index) => ({ name: `Mode ${index}` })) }));
vi.mock('./modes/tunnel', () => ({ resetRings: vi.fn() }));
vi.mock('./effects/transition', async (importOriginal) => ({ ...(await importOriginal<object>()), startTransition: vi.fn() }));
vi.mock('./color', () => ({ setPalette: vi.fn() }));

let stored: Map<string, string>;

beforeEach(() => {
  stored = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
  vi.resetModules();
});

afterEach(() => vi.unstubAllGlobals());

describe('tuning groups', () => {
  it('keeps only motion, punch and colour speed per mode', () => {
    expect(GLOBAL_CONTROLS.map(({ key }) => key)).toEqual(['gain', 'beatSensitivity', 'dropSensitivity', 'reactivity', 'contrast', 'pixelSize', 'pixelGap']);
    expect(MODE_CONTROLS.map(({ key }) => key)).toEqual(['motion', 'punch', 'colorSpeed']);
  });
});

describe('session persistence', () => {
  it('restores calibration and the last look with clamping', async () => {
    stored.set('djviz.calibration.v1', JSON.stringify({ autoGain: false, gain: 140, noiseGate: 0.05, beatSensitivity: 1.4 }));
    stored.set(
      'djviz.session.v1',
      JSON.stringify({
        look: { mode: 5, palette: 3, mirror: 2, psy: 1, effects: { lasers: true }, tuning: { motion: 1.7, reactivity: 9 } },
        auto: true,
        changeOn: 's30',
        shuffle: true,
        source: 'mic',
      }),
    );
    const { restoreSession } = await import('./session');
    const { settings } = await import('./state');
    restoreSession();
    expect(settings).toMatchObject({ autoGain: false, gain: 100, beatSensitivity: 1.4, dropSensitivity: 1 });
    expect(settings).toMatchObject({ mode: 5, palette: 3, mirror: 2, psy: 1, lasers: true, motion: 1.7, reactivity: 3, auto: true });
  });

  it('ignores legacy playback keys and a stored source', async () => {
    stored.set('djviz.session.v1', JSON.stringify({ changeOn: 'b7', source: 'radio' }));
    const { restoreSession } = await import('./session');
    const { currentFolder } = await import('./presets/library');
    restoreSession();
    expect(currentFolder()?.changeOn).toBe('b32');
  });

  it('rescales intensity from the old session and keeps the new one as saved', async () => {
    stored.set('djviz.session.v1', JSON.stringify({ look: { tuning: { reactivity: 0.2 } } }));
    const { restoreSession } = await import('./session');
    const { settings } = await import('./state');
    restoreSession();
    expect(settings.reactivity).toBeCloseTo(1);
    stored.set('djviz.session.v2', JSON.stringify({ look: { tuning: { reactivity: 0.6 } } }));
    vi.resetModules();
    const fresh = await import('./session');
    const freshState = await import('./state');
    fresh.restoreSession();
    expect(freshState.settings.reactivity).toBe(0.6);
  });

  it('remembers the chosen input device with calibration', async () => {
    stored.set('djviz.calibration.v1', JSON.stringify({ inputDevice: 'usb-mixer' }));
    const { restoreSession, saveSession } = await import('./session');
    const { audio } = await import('./audio/input');
    restoreSession();
    expect(audio.inputDevice).toBe('usb-mixer');
    audio.inputDevice = 'interface-2';
    saveSession();
    expect(JSON.parse(stored.get('djviz.calibration.v1')!)).toMatchObject({ inputDevice: 'interface-2' });
  });

  it('saves calibration and session under separate keys', async () => {
    const { saveSession } = await import('./session');
    const { settings } = await import('./state');
    Object.assign(settings, { gain: 33, autoGain: false, mode: 4, reactivity: 2, motion: 1.5 });
    saveSession();
    const calibration = JSON.parse(stored.get('djviz.calibration.v1')!);
    const session = JSON.parse(stored.get('djviz.session.v2')!);
    const profiles = JSON.parse(stored.get('djviz.modeTuning.v1')!);
    expect(calibration).toEqual({
      autoGain: false,
      inputDevice: '',
      gain: 33,
      beatSensitivity: 1,
      dropSensitivity: 1,
      reactivity: 2,
      contrast: 0.7,
      pixelSize: 12,
      pixelGap: 0.15,
    });
    expect(profiles).toEqual({ 'Mode 4': { motion: 1.5, punch: 1, colorSpeed: 1 } });
    expect(session).toMatchObject({ look: { mode: 4 } });
    expect(session.look).not.toHaveProperty('tuning');
    expect(session).not.toHaveProperty('source');
    expect(session).not.toHaveProperty('changeOn');
    expect(session).not.toHaveProperty('shuffle');
  });

  it('restores each mode profile and applies the current one', async () => {
    stored.set('djviz.session.v2', JSON.stringify({ look: { mode: 2 } }));
    stored.set('djviz.modeTuning.v1', JSON.stringify({ 'Mode 2': { motion: 1.6, punch: 9 }, 'Mode 3': { motion: 0.2 } }));
    const { restoreSession } = await import('./session');
    const { settings } = await import('./state');
    const { modeTuning } = await import('./modeTuning');
    restoreSession();
    expect(settings).toMatchObject({ mode: 2, motion: 1.6, punch: 2, colorSpeed: 1 });
    expect(modeTuning['Mode 3']).toEqual({ motion: 0.2, punch: 1, colorSpeed: 1 });
  });

  it('seeds only the current mode from tuning saved in an older session', async () => {
    stored.set('djviz.session.v2', JSON.stringify({ look: { mode: 2, tuning: { motion: 1.6, contrast: 0.3 } } }));
    const { restoreSession } = await import('./session');
    const { settings } = await import('./state');
    const { modeTuning } = await import('./modeTuning');
    restoreSession();
    expect(settings).toMatchObject({ motion: 1.6, contrast: 0.3 });
    expect(Object.keys(modeTuning)).toEqual(['Mode 2']);
  });
});
