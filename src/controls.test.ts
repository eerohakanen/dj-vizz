import { describe, expect, it, vi } from 'vitest';
import { KEYMAP, keysFor, modeIndexFor, resolveKey, shortcutFor } from './controls';
import type { LiveMode } from './store';

vi.mock('./actions', () => ({
  cycleMirror: vi.fn(),
  cyclePsy: vi.fn(),
  nextScene: vi.fn(),
  nudgeGain: vi.fn(),
  openOverlay: vi.fn(),
  openPresets: vi.fn(),
  previousScene: vi.fn(),
  setControlsHidden: vi.fn(),
  setHideLocked: vi.fn(),
  setPeek: vi.fn(),
  switchToEdit: vi.fn(),
  toggleDebug: vi.fn(),
  toggleFullscreen: vi.fn(),
  togglePaused: vi.fn(),
  toggleSetting: vi.fn(),
}));
vi.mock('./audio/input', () => ({ audio: {} }));
vi.mock('./color', () => ({ setPalette: vi.fn() }));
vi.mock('./events', () => ({ triggerDrop: vi.fn() }));
vi.mock('./mode', () => ({ setMode: vi.fn() }));
vi.mock('./state', () => ({ settings: {} }));
vi.mock('./store', () => ({ ui: {} }));

const press = (key: string, code = '', shiftKey = false) => ({ key, code, shiftKey });
const MODES: LiveMode[] = ['explore', 'play', 'edit'];
const idFor = (key: string, code = '', shiftKey = false, mode: LiveMode = 'explore') =>
  resolveKey(press(key, code, shiftKey), mode)?.id;
const idIn = (mode: LiveMode, key: string) => idFor(key, '', false, mode);

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

  it('treats a shifted digit that types itself as a plain digit', () => {
    expect(modeIndexFor(press('1', 'Digit1', true))).toBe(0);
    expect(modeIndexFor(press('2', 'Digit2', true))).toBe(1);
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

  it('ignores look editing keys in play mode', () => {
    for (const key of ['1', 'c', 'p', 'k', 'l', 'x', 's', 'a', 'Enter', 't']) {
      expect(idIn('play', key)).toBeUndefined();
    }
  });

  it('steps scenes with the arrows in play and modes elsewhere', () => {
    expect(idIn('play', 'ArrowRight')).toBe('sceneStep');
    expect(idIn('edit', 'ArrowRight')).toBe('modeStep');
    expect(idIn('explore', 'ArrowLeft')).toBe('modeStep');
  });

  it('uses Space for the next scene only when a preset is open', () => {
    expect(idIn('play', ' ')).toBe('sceneNext');
    expect(idIn('edit', ' ')).toBe('sceneNext');
    expect(idIn('explore', ' ')).toBeUndefined();
  });

  it('gives E to trails while editing and to edit while playing', () => {
    expect(idIn('play', 'e')).toBe('edit');
    expect(idIn('edit', 'e')).toBe('trails');
    expect(idIn('explore', 'e')).toBe('trails');
  });

  it('toggles the scene list with M only in edit mode', () => {
    expect(idIn('edit', 'm')).toBe('scenes');
    expect(idIn('play', 'm')).toBeUndefined();
    expect(idIn('explore', 'm')).toBeUndefined();
  });

  it('keeps auto-switch to explore mode', () => {
    expect(idIn('explore', 'a')).toBe('auto');
    expect(idIn('edit', 'a')).toBeUndefined();
  });

  it('leaves to the presets menu from a preset and asks before exiting explore', () => {
    expect(idIn('explore', 'q')).toBe('exit');
    expect(idIn('play', 'q')).toBe('menu');
    expect(idIn('edit', 'q')).toBe('menu');
  });

  it('keeps view and audio keys in every mode', () => {
    for (const mode of MODES) {
      expect([idIn(mode, 'b'), idIn(mode, 'f'), idIn(mode, 'h'), idIn(mode, '?'), idIn(mode, 'ArrowUp'), idIn(mode, 'g')]).toEqual([
        'pause',
        'fullscreen',
        'hide',
        'help',
        'gain',
        'autoGain',
      ]);
    }
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

  it('gives each printable key to one entry per mode', () => {
    const keys = [...'abcdefghijklmnopqrstuvwxyz0123456789+-?/ ', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    for (const mode of MODES) {
      for (const key of keys) {
        expect(keysFor(mode).filter((entry) => entry.matches(press(key))).length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('lists only the keys available in a mode', () => {
    const playIds = keysFor('play').map((entry) => entry.id);
    expect(playIds).toContain('sceneStep');
    expect(playIds).not.toContain('palette');
    expect(keysFor('explore').map((entry) => entry.id)).not.toContain('sceneNext');
  });

  it('exposes display strings by id', () => {
    expect(shortcutFor('psy')).toBe('P');
    expect(shortcutFor('pause')).toBe('B');
    expect(shortcutFor('missing')).toBe('');
  });
});
