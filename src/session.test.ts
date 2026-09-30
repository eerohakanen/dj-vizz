import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CALIBRATION_CONTROLS, LOOK_CONTROLS } from './tuning';

vi.mock('./canvas', () => ({ output: {}, transitionCtx: {}, transitionFrame: {} }));
vi.mock('./modes/index', () => ({ MODES: Array.from({ length: 12 }, (_, index) => ({ name: `Mode ${index}` })) }));
vi.mock('./mode', () => ({ setMode: vi.fn() }));
vi.mock('./color', () => ({ setPalette: vi.fn() }));
vi.mock('./audio/input', () => ({ audio: { source: null } }));

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
  it('splits Input and Detection from Response', () => {
    expect(CALIBRATION_CONTROLS.map(({ key }) => key)).toEqual(['gain', 'noiseGate', 'beatSensitivity', 'dropSensitivity']);
    expect(LOOK_CONTROLS.map(({ key }) => key)).toEqual(['reactivity', 'motion', 'punch', 'flashes', 'particles', 'colorSpeed', 'trailLength']);
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
    const { restoreSession, lastAudioSource } = await import('./session');
    const { settings } = await import('./state');
    restoreSession();
    expect(settings).toMatchObject({ autoGain: false, gain: 100, noiseGate: 0.05, beatSensitivity: 1.4, dropSensitivity: 1 });
    expect(settings).toMatchObject({ mode: 5, palette: 3, mirror: 2, psy: 1, lasers: true, trails: true, motion: 1.7, reactivity: 3, auto: true });
    expect(lastAudioSource()).toBe('mic');
  });

  it('ignores legacy playback keys and a bad source', async () => {
    stored.set('djviz.session.v1', JSON.stringify({ changeOn: 'b7', source: 'radio' }));
    const { restoreSession, lastAudioSource } = await import('./session');
    const { currentFolder } = await import('./presets/library');
    restoreSession();
    expect(currentFolder()?.changeOn).toBe('b32');
    expect(lastAudioSource()).toBeNull();
  });

  it('saves calibration and session under separate keys', async () => {
    const { saveSession } = await import('./session');
    const { settings } = await import('./state');
    Object.assign(settings, { gain: 33, autoGain: false, mode: 4, reactivity: 2 });
    saveSession();
    const calibration = JSON.parse(stored.get('djviz.calibration.v1')!);
    const session = JSON.parse(stored.get('djviz.session.v1')!);
    expect(calibration).toEqual({ autoGain: false, gain: 33, noiseGate: 0.03, beatSensitivity: 1, dropSensitivity: 1 });
    expect(session).toMatchObject({ look: { mode: 4, tuning: { reactivity: 2 } }, source: null });
    expect(session).not.toHaveProperty('changeOn');
    expect(session).not.toHaveProperty('shuffle');
    expect(session.look.tuning).not.toHaveProperty('gain');
  });

  it('remembers the audio source kind after a change is notified', async () => {
    const { restoreSession, lastAudioSource } = await import('./session');
    const { audio } = await import('./audio/input');
    const { notify } = await import('./store');
    restoreSession();
    audio.source = 'window';
    notify();
    audio.source = null;
    notify();
    expect(lastAudioSource()).toBe('window');
  });
});
