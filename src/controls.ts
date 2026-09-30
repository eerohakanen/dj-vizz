import {
  cycleMirror,
  cyclePsy,
  nextScene,
  nudgeGain,
  openOverlay,
  openPresets,
  previousScene,
  setControlsHidden,
  setHideLocked,
  setPeek,
  switchToEdit,
  syncFullscreen,
  toggleDebug,
  toggleFullscreen,
  togglePaused,
  toggleSetting,
} from './actions';
import { audio } from './audio/input';
import { setPalette } from './color';
import { triggerDrop } from './events';
import { setMode } from './mode';
import { settings } from './state';
import { ui, type LiveMode } from './store';

const IDLE_HIDE_MS = 4000;

export type KeyGroup = 'Scenes' | 'Modes' | 'Style' | 'Effects' | 'Audio' | 'View';

export type KeyLike = Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey'>;

export interface KeyEntry {
  id: string;
  group: KeyGroup;
  help: string;
  display: string[];
  modes?: readonly LiveMode[];
  matches: (event: KeyLike) => boolean;
  run: (event: KeyboardEvent) => void;
}

const SHIFT_MODE_CODES = ['Digit1', 'Digit2'];
const FIRST_SHIFT_MODE = 10;

export function modeIndexFor({ key, code, shiftKey }: KeyLike) {
  const digitTyped = /^[0-9]$/.test(key);
  if (shiftKey && !digitTyped) {
    const index = SHIFT_MODE_CODES.indexOf(code);
    return index < 0 ? undefined : FIRST_SHIFT_MODE + index;
  }
  return digitTyped ? (+key + 9) % 10 : undefined;
}

const keyIn =
  (...keys: string[]) =>
  ({ key }: KeyLike) =>
    keys.includes(key.toLowerCase());

const LOOK_EDITING: readonly LiveMode[] = ['explore', 'edit'];
const PRESET_MODES: readonly LiveMode[] = ['play', 'edit'];

const gainUp = () => nudgeGain(5);
const gainDown = () => nudgeGain(-5);

export const KEYMAP: KeyEntry[] = [
  {
    id: 'sceneStep',
    group: 'Scenes',
    help: 'Previous / next scene',
    display: ['←', '→'],
    modes: ['play'],
    matches: keyIn('arrowleft', 'arrowright'),
    run: (event) => (event.key === 'ArrowRight' ? nextScene() : previousScene()),
  },
  {
    id: 'sceneNext',
    group: 'Scenes',
    help: 'Next scene',
    display: ['Space'],
    modes: PRESET_MODES,
    matches: keyIn(' '),
    run: nextScene,
  },
  {
    id: 'scenes',
    group: 'Scenes',
    help: 'Show / hide the scene list',
    display: ['M'],
    modes: ['edit'],
    matches: keyIn('m'),
    run: () => openOverlay('scenes'),
  },
  {
    id: 'edit',
    group: 'Scenes',
    help: 'Edit this preset',
    display: ['E'],
    modes: ['play'],
    matches: keyIn('e'),
    run: switchToEdit,
  },
  {
    id: 'mode',
    group: 'Modes',
    help: 'Pick a mode',
    display: ['1–0', '⇧1–⇧2'],
    modes: LOOK_EDITING,
    matches: (event) => modeIndexFor(event) !== undefined,
    run: (event) => setMode(modeIndexFor(event) ?? settings.mode),
  },
  {
    id: 'modeStep',
    group: 'Modes',
    help: 'Previous / next mode',
    display: ['←', '→'],
    modes: LOOK_EDITING,
    matches: keyIn('arrowleft', 'arrowright'),
    run: (event) => setMode(settings.mode + (event.key === 'ArrowRight' ? 1 : -1)),
  },
  {
    id: 'palette',
    group: 'Style',
    help: 'Next palette (Shift+C previous)',
    display: ['C'],
    modes: LOOK_EDITING,
    matches: keyIn('c'),
    run: (event) => setPalette(settings.palette + (event.shiftKey ? -1 : 1)),
  },
  {
    id: 'psy',
    group: 'Style',
    help: 'Cycle psychedelic effect',
    display: ['P'],
    modes: LOOK_EDITING,
    matches: keyIn('p'),
    run: cyclePsy,
  },
  {
    id: 'mirror',
    group: 'Style',
    help: 'Cycle mirror',
    display: ['K'],
    modes: LOOK_EDITING,
    matches: keyIn('k'),
    run: cycleMirror,
  },
  {
    id: 'lasers',
    group: 'Effects',
    help: 'Lasers',
    display: ['L'],
    modes: LOOK_EDITING,
    matches: keyIn('l'),
    run: () => toggleSetting('lasers'),
  },
  {
    id: 'glitch',
    group: 'Effects',
    help: 'Glitch',
    display: ['X'],
    modes: LOOK_EDITING,
    matches: keyIn('x'),
    run: () => toggleSetting('glitch'),
  },
  {
    id: 'strobe',
    group: 'Effects',
    help: 'Strobe',
    display: ['S'],
    modes: LOOK_EDITING,
    matches: keyIn('s'),
    run: () => toggleSetting('strobe'),
  },
  {
    id: 'trails',
    group: 'Effects',
    help: 'Trails',
    display: ['E'],
    modes: LOOK_EDITING,
    matches: keyIn('e'),
    run: () => toggleSetting('trails'),
  },
  {
    id: 'auto',
    group: 'Effects',
    help: 'Auto-switch on drops and every 32-beat phrase',
    display: ['A'],
    modes: ['explore'],
    matches: keyIn('a'),
    run: () => toggleSetting('auto'),
  },
  {
    id: 'drop',
    group: 'Effects',
    help: 'Fire a drop',
    display: ['Enter'],
    modes: LOOK_EDITING,
    matches: keyIn('enter'),
    run: triggerDrop,
  },
  {
    id: 'tune',
    group: 'Audio',
    help: 'Tune levels and effect strength',
    display: ['T'],
    modes: LOOK_EDITING,
    matches: keyIn('t'),
    run: () => openOverlay('tuning'),
  },
  {
    id: 'gain',
    group: 'Audio',
    help: 'Gain up / down',
    display: ['↑', '↓'],
    matches: keyIn('arrowup', 'arrowdown', '+', '-'),
    run: (event) => (event.key === 'ArrowUp' || event.key === '+' ? gainUp() : gainDown()),
  },
  {
    id: 'autoGain',
    group: 'Audio',
    help: 'Automatic gain',
    display: ['G'],
    matches: keyIn('g'),
    run: () => toggleSetting('autoGain'),
  },
  {
    id: 'debug',
    group: 'Audio',
    help: 'Audio analysis overlay',
    display: ['D'],
    matches: keyIn('d'),
    run: toggleDebug,
  },
  {
    id: 'pause',
    group: 'View',
    help: 'Pause / resume visuals',
    display: ['B'],
    matches: keyIn('b'),
    run: togglePaused,
  },
  {
    id: 'fullscreen',
    group: 'View',
    help: 'Fullscreen',
    display: ['F'],
    matches: keyIn('f'),
    run: toggleFullscreen,
  },
  {
    id: 'hide',
    group: 'View',
    help: 'Hide / show controls',
    display: ['H'],
    matches: keyIn('h'),
    run: () => setHideLocked(!ui.hideLocked),
  },
  {
    id: 'exit',
    group: 'View',
    help: 'Back to main menu',
    display: ['Q'],
    modes: ['explore'],
    matches: keyIn('q'),
    run: () => openOverlay('exit'),
  },
  {
    id: 'menu',
    group: 'View',
    help: 'Back to presets menu',
    display: ['Q'],
    modes: PRESET_MODES,
    matches: keyIn('q'),
    run: openPresets,
  },
  {
    id: 'help',
    group: 'View',
    help: 'This help',
    display: ['?'],
    matches: keyIn('?', '/'),
    run: () => openOverlay('help'),
  },
];

export const KEY_GROUPS: KeyGroup[] = ['Scenes', 'Modes', 'Style', 'Effects', 'Audio', 'View'];

export const keysFor = (mode: LiveMode) => KEYMAP.filter((entry) => !entry.modes || entry.modes.includes(mode));

export const resolveKey = (event: KeyLike, mode: LiveMode) => keysFor(mode).find((entry) => entry.matches(event));

export const shortcutFor = (id: string) => KEYMAP.find((entry) => entry.id === id)?.display.join(', ') ?? '';

const isTyping = (target: Element) => target.matches('input, textarea, select, [contenteditable="true"]');
const isInMenu = (target: Element) => !!target.closest('[role="menu"], [role="listbox"], [role="slider"], [role="dialog"]');

function blurToolbarFocus() {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.closest('[data-toolbar]')) active.blur();
}

function handleKey(event: KeyboardEvent) {
  if (ui.screen !== 'live' || event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target as Element;
  if (isTyping(target) || isInMenu(target)) return;
  const entry = resolveKey(event, ui.liveMode);
  if (!entry) return;
  event.preventDefault();
  blurToolbarFocus();
  entry.run(event);
}

let idleTimer: ReturnType<typeof setTimeout> | undefined;

const hasOpenPopup = () => !!document.querySelector('[data-radix-popper-content-wrapper]');
const isHoveringReveal = () => !!document.querySelector('[data-reveal]:hover');

function peekReveal() {
  setPeek(true);
  idleTimer = setTimeout(() => {
    if (!isHoveringReveal()) setPeek(false);
  }, IDLE_HIDE_MS);
}

function wake() {
  clearTimeout(idleTimer);
  if (ui.hideLocked) {
    peekReveal();
    return;
  }
  setControlsHidden(false);
  idleTimer = setTimeout(() => {
    if (audio.live && !ui.overlay && !hasOpenPopup()) setControlsHidden(true);
  }, IDLE_HIDE_MS);
}

export function bindControls() {
  addEventListener('keydown', handleKey);
  document.addEventListener('fullscreenchange', syncFullscreen);
  addEventListener('pointermove', wake);
  addEventListener('touchstart', wake, { passive: true });
}
