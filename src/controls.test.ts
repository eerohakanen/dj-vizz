import { describe, expect, it, vi } from 'vitest';
import { isMenuBackKey, KEYMAP, keysFor, modeIndexFor, modeKeyFor, resolveKey, shortcutBlocked, shortcutFor, type ShortcutTarget } from './controls';
import type { LiveMode } from './store';

vi.mock('./actions', () => ({
  cycleMirror: vi.fn(),
  cyclePixelate: vi.fn(),
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

  it('maps Shift+1 to Shift+0 by physical key to modes 11 to 20', () => {
    expect(modeIndexFor(press('!', 'Digit1', true))).toBe(10);
    expect(modeIndexFor(press('@', 'Digit2', true))).toBe(11);
    expect(modeIndexFor(press('#', 'Digit3', true))).toBe(12);
    expect(modeIndexFor(press('^', 'Digit6', true))).toBe(15);
    expect(modeIndexFor(press('=', 'Digit0', true))).toBe(19);
    expect(modeIndexFor(press('&', 'Digit1', true))).toBe(10);
  });

  it('treats a shifted digit that types itself as a plain digit', () => {
    expect(modeIndexFor(press('1', 'Digit1', true))).toBe(0);
    expect(modeIndexFor(press('2', 'Digit2', true))).toBe(1);
  });

  it('ignores other shifted digits and non-digits', () => {
    expect(modeIndexFor(press('_', 'Minus', true))).toBeUndefined();
    expect(modeIndexFor(press('a', 'KeyA'))).toBeUndefined();
  });
});

describe('modeKeyFor', () => {
  it('round-trips with modeIndexFor', () => {
    expect(modeKeyFor(0)).toBe('1');
    expect(modeKeyFor(9)).toBe('0');
    expect(modeKeyFor(10)).toBe('⇧1');
    expect(modeKeyFor(11)).toBe('⇧2');
    expect(modeKeyFor(15)).toBe('⇧6');
    expect(modeKeyFor(19)).toBe('⇧0');
  });

  it('has no key past the shifted modes', () => {
    expect(modeKeyFor(20)).toBeUndefined();
  });
});

describe('resolveKey', () => {
  it('resolves letters case-insensitively', () => {
    expect(idFor('k')).toBe('mirror');
    expect(idFor('i')).toBe('pixelate');
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
    for (const key of ['1', 'c', 'p', 'k', 'i', 'l', 'x', 's', 'a', 'Enter', 't']) {
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

  it('gives E to edit only while playing', () => {
    expect(idIn('play', 'e')).toBe('edit');
    expect(idIn('edit', 'e')).toBeUndefined();
    expect(idIn('explore', 'e')).toBeUndefined();
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
    expect(idFor('_', 'Minus', true)).toBeUndefined();
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

describe('shortcutBlocked', () => {
  const element = (selectors: string[], parent?: ShortcutTarget): ShortcutTarget => {
    const self: ShortcutTarget = {
      matches: (selector: string) => selectors.includes(selector),
      closest: (selector: string) => (selectors.includes(selector) ? self : (parent?.closest(selector) ?? null)),
    };
    return self;
  };
  const panel = element(['[data-side-panel]', '[role="dialog"]']);
  const modal = element(['[role="dialog"]']);
  const panelButton = element(['button'], panel);

  it('lets shortcuts through from buttons in a side panel', () => {
    expect(shortcutBlocked(panelButton, 'c')).toBe(false);
    expect(shortcutBlocked(panel, ' ')).toBe(false);
  });

  it('leaves Space and Enter to a focused side panel button', () => {
    expect(shortcutBlocked(panelButton, ' ')).toBe(true);
    expect(shortcutBlocked(panelButton, 'Enter')).toBe(true);
  });

  it('guards text entry, selects and switches inside a side panel', () => {
    expect(shortcutBlocked(element(['input'], panel), 'c')).toBe(true);
    expect(shortcutBlocked(element(['button', '[role="combobox"]'], panel), 'c')).toBe(true);
    expect(shortcutBlocked(element(['button', '[role="switch"]'], panel), 'c')).toBe(true);
  });

  it('guards modal dialogs and open menus', () => {
    expect(shortcutBlocked(element(['button'], modal), 'c')).toBe(true);
    expect(shortcutBlocked(element(['[role="menuitem"]'], element(['[role="menu"]'])), 'c')).toBe(true);
  });

  it('allows shortcuts from the page itself', () => {
    expect(shortcutBlocked(element([]), ' ')).toBe(false);
  });
});

describe('isMenuBackKey', () => {
  const escape = { key: 'Escape', defaultPrevented: false, metaKey: false, ctrlKey: false, altKey: false };

  it('goes back on a plain Escape with nothing open', () => {
    expect(isMenuBackKey(escape, false)).toBe(true);
  });

  it('leaves Escape to an open dialog or menu', () => {
    expect(isMenuBackKey(escape, true)).toBe(false);
    expect(isMenuBackKey({ ...escape, defaultPrevented: true }, false)).toBe(false);
  });

  it('ignores other keys and modified Escape', () => {
    expect(isMenuBackKey({ ...escape, key: 'Backspace' }, false)).toBe(false);
    expect(isMenuBackKey({ ...escape, metaKey: true }, false)).toBe(false);
  });
});
