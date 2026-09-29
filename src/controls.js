import { cycleMirror, cyclePsy, nudgeGain, openOverlay, setControlsHidden, setHideLocked, setPeek, toggleFullscreen, toggleSetting } from './actions.js';
import { audio } from './audio/input.js';
import { setPalette } from './color.js';
import { triggerDrop } from './events.js';
import { setMode } from './mode.js';
import { MODES } from './modes/index.js';
import { nextPreset } from './presets/playlist.js';
import { settings } from './state.js';
import { ui } from './store.js';

const IDLE_HIDE_MS = 4000;

const preventingDefault = (action) => (event) => {
  event.preventDefault();
  action();
};

const gainUp = preventingDefault(() => nudgeGain(5));
const gainDown = preventingDefault(() => nudgeGain(-5));

const KEY_ACTIONS = {
  arrowright: () => setMode(settings.mode + 1),
  arrowleft: () => setMode(settings.mode - 1),
  arrowup: gainUp,
  '+': gainUp,
  arrowdown: gainDown,
  '-': gainDown,
  ' ': preventingDefault(nextPreset),
  enter: preventingDefault(triggerDrop),
  k: cycleMirror,
  e: () => toggleSetting('trails'),
  a: () => toggleSetting('auto'),
  c: (event) => setPalette(settings.palette + (event.shiftKey ? -1 : 1)),
  f: toggleFullscreen,
  h: () => setHideLocked(!ui.hideLocked),
  l: () => toggleSetting('lasers'),
  x: () => toggleSetting('glitch'),
  s: () => toggleSetting('strobe'),
  g: () => toggleSetting('autoGain'),
  p: cyclePsy,
  q: () => openOverlay('exit'),
  m: () => openOverlay('presets'),
  '?': () => openOverlay('help'),
  '/': () => openOverlay('help'),
};

const isTyping = (target) => target.matches('input, textarea, select, [contenteditable="true"]');
const isInMenu = (target) => !!target.closest('[role="menu"], [role="listbox"], [role="slider"], [role="dialog"]');

function handleKey(event) {
  if (!ui.live || event.metaKey || event.ctrlKey || event.altKey) return;
  if (isTyping(event.target) || isInMenu(event.target)) return;
  const key = event.key.toLowerCase();
  if (/^[0-9]$/.test(key)) {
    setMode(key === '0' ? MODES.length - 1 : +key - 1);
    return;
  }
  if (Object.hasOwn(KEY_ACTIONS, key)) {
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) document.activeElement.blur();
    KEY_ACTIONS[key](event);
  }
}

let idleTimer;

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
  addEventListener('pointermove', wake);
  addEventListener('touchstart', wake, { passive: true });
}
