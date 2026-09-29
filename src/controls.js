import { audio, captureMicrophone, captureTab, playFile } from './audio/input.js';
import { setPalette } from './color.js';
import { $, setButtonOn } from './dom.js';
import { startTransition } from './effects/transition.js';
import { triggerDrop } from './events.js';
import { setMode } from './mode.js';
import { MODES } from './modes/index.js';
import { togglePanel } from './presets/panel.js';
import { nextPreset } from './presets/playlist.js';
import { settings } from './state.js';
import { MIRROR_NAMES, PSY_NAMES, renderMirrorButton, renderPsyButton, renderReactivity } from './ui.js';

const IDLE_HIDE_MS = 4000;

const toggleSetting = (key, buttonId) => () => {
  settings[key] = !settings[key];
  setButtonOn(buttonId, settings[key]);
};

const toggleTrails = toggleSetting('trails', 'bFb');
const toggleAuto = toggleSetting('auto', 'bAuto');
const toggleLasers = toggleSetting('lasers', 'bLas');
const toggleGlitch = toggleSetting('glitch', 'bGl');
const toggleStrobe = toggleSetting('strobe', 'bStb');
const toggleAutoGain = toggleSetting('autoGain', 'bAgc');

function cycleMirror() {
  startTransition();
  settings.mirror = (settings.mirror + 1) % MIRROR_NAMES.length;
  renderMirrorButton();
}

function cyclePsy() {
  settings.psy = (settings.psy + 1) % PSY_NAMES.length;
  renderPsyButton();
}

const toggleHelp = () => $('help').classList.toggle('show');
const toggleControls = () => $('ui').classList.toggle('hide');

const toggleFullscreen = () =>
  document.fullscreenElement
    ? document.exitFullscreen()
    : document.documentElement.requestFullscreen().catch(() => {});

function nudgeGain(step) {
  settings.gain = Math.max(0, Math.min(100, settings.gain + step));
  $('gain').value = settings.gain;
}

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
  e: toggleTrails,
  a: toggleAuto,
  c: (event) => setPalette(settings.palette + (event.shiftKey ? -1 : 1)),
  f: toggleFullscreen,
  h: toggleControls,
  l: toggleLasers,
  x: toggleGlitch,
  s: toggleStrobe,
  g: toggleAutoGain,
  p: cyclePsy,
  m: togglePanel,
  '?': toggleHelp,
  '/': toggleHelp,
};

function handleKey(event) {
  if (event.target.matches('input[type=text],select')) return;
  if (event.target.tagName === 'INPUT' && event.key.startsWith('Arrow')) return;
  const key = event.key.toLowerCase();
  if (/^[0-9]$/.test(key)) {
    setMode(key === '0' ? MODES.length - 1 : +key - 1);
    return;
  }
  if (Object.hasOwn(KEY_ACTIONS, key)) KEY_ACTIONS[key](event);
}

let idleTimer;

function wake() {
  $('ui').classList.remove('hide');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (audio.live) $('ui').classList.add('hide');
  }, IDLE_HIDE_MS);
}

function bindAudioInputs() {
  $('bTab').onclick = captureTab;
  $('bMic').onclick = captureMicrophone;
  $('file').onchange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    playFile(file);
    event.target.value = '';
  };
}

function bindButtons() {
  $('bMode').onclick = () => setMode(settings.mode + 1);
  $('bMode').oncontextmenu = (event) => {
    event.preventDefault();
    setMode(settings.mode - 1);
  };
  $('bCol').onclick = () => setPalette(settings.palette + 1);
  $('bPsy').onclick = cyclePsy;
  $('bKal').onclick = cycleMirror;
  $('bFb').onclick = toggleTrails;
  $('bAuto').onclick = toggleAuto;
  $('bLas').onclick = toggleLasers;
  $('bGl').onclick = toggleGlitch;
  $('bStb').onclick = toggleStrobe;
  $('bAgc').onclick = toggleAutoGain;
  $('bPre').onclick = togglePanel;
  $('bHelp').onclick = toggleHelp;
  $('help').onclick = toggleHelp;
  $('bFs').onclick = toggleFullscreen;
  document.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => button.blur()));
}

function bindSliders() {
  $('gain').oninput = () => {
    settings.gain = +$('gain').value;
  };
  $('react').oninput = () => {
    settings.reactivity = +$('react').value;
    renderReactivity();
  };
}

export function bindControls() {
  bindAudioInputs();
  bindButtons();
  bindSliders();
  addEventListener('keydown', handleKey);
  addEventListener('mousemove', wake);
  addEventListener('touchstart', wake, { passive: true });
}
