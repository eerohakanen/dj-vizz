import { describe, expect, it, vi } from 'vitest';
import { KEYMAP, modeIndexFor, resolveKey, shortcutFor } from './controls';

vi.mock('./actions', () => ({
  cycleMirror: vi.fn(),
  cyclePsy: vi.fn(),
  nudgeGain: vi.fn(),
  openOverlay: vi.fn(),
  setControlsHidden: vi.fn(),
  setHideLocked: vi.fn(),
  setPeek: vi.fn(),
  toggleDebug: vi.fn(),
  toggleFullscreen: vi.fn(),
  togglePaused: vi.fn(),
  toggleSetting: vi.fn(),
}));
vi.mock('./audio/input', () => ({ audio: {} }));
vi.mock('./color', () => ({ setPalette: vi.fn() }));
vi.mock('./events', () => ({ triggerDrop: vi.fn() }));
vi.mock('./mode', () => ({ setMode: vi.fn() }));
vi.mock('./presets/playlist', () => ({ nextPreset: vi.fn() }));
vi.mock('./state', () => ({ settings: {} }));
vi.mock('./store', () => ({ ui: {} }));

const press = (key: string, code = '', shiftKey = false) => ({ key, code, shiftKey });
const idFor = (key: string, code = '', shiftKey = false) => resolveKey(press(key, code, shiftKey))?.id;

describe('modeIndexFor', () => {
  it('maps 1-9 to modes 1-9 and 0 to mode 10', () => {
    expect(modeIndexFor(press('1', 'Digit1'))).toBe(0);
    expect(modeIndexFor(press('9', 'Digit9'))).toBe(8);
    expect(modeIndexFor(press('0', 'Digit0'))).toBe(9);
  });

  it('maps Shift+1 and Shift+2 by physical key to modes 11 and 12', () => {
    expect(modeIndexFor(press('!', 'Digit1', true))).toBe(10);
    expect(modeIndexFor(press('@', 'Digit2', true))).toBe(11);
    expect(modeIndexFor(press('&', 'Digit1', true))).toBe(10);
  });

  it('ignores other shifted digits and non-digits', () => {
    expect(modeIndexFor(press('#', 'Digit3', true))).toBeUndefined();
    expect(modeIndexFor(press('a', 'KeyA'))).toBeUndefined();
  });
});

describe('resolveKey', () => {
  it('resolves letters case-insensitively', () => {
    expect(idFor('k')).toBe('mirror');
    expect(idFor('C', 'KeyC', true)).toBe('palette');
  });

  it('resolves pause to B', () => {
    expect(idFor('b')).toBe('pause');
  });

  it('resolves both help keys and both gain key pairs', () => {
    expect(idFor('?', 'Slash', true)).toBe('help');
    expect(idFor('/')).toBe('help');
    expect(idFor('+')).toBe('gain');
    expect(idFor('ArrowDown')).toBe('gain');
  });

  it('resolves digits to the mode entry', () => {
    expect(idFor('3', 'Digit3')).toBe('mode');
    expect(idFor('!', 'Digit1', true)).toBe('mode');
  });

  it('returns nothing for unbound keys', () => {
    expect(idFor('z')).toBeUndefined();
    expect(idFor('#', 'Digit3', true)).toBeUndefined();
  });
});

describe('KEYMAP', () => {
  it('has unique ids', () => {
    const ids = KEYMAP.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives each printable key to one entry', () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    for (const letter of letters) {
      expect(KEYMAP.filter((entry) => entry.matches(press(letter))).length).toBeLessThanOrEqual(1);
    }
  });

  it('exposes display strings by id', () => {
    expect(shortcutFor('psy')).toBe('P');
    expect(shortcutFor('pause')).toBe('B');
    expect(shortcutFor('missing')).toBe('');
  });
});
