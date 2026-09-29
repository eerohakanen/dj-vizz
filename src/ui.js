import { renderPaletteButton } from './color.js';
import { $, setButtonOn } from './dom.js';
import { renderModeButton } from './mode.js';
import { settings } from './state.js';

export const MIRROR_NAMES = ['Off', 'Mirror', 'Quad', 'Kaleido'];
export const PSY_NAMES = ['Off', 'Vortex', 'Liquid', 'Rainbow', 'Trip'];

export function renderPsyButton() {
  $('bPsy').textContent = `Psy: ${PSY_NAMES[settings.psy]} (P)`;
  setButtonOn('bPsy', settings.psy > 0);
}

export function renderMirrorButton() {
  $('bKal').textContent = `Mirror: ${MIRROR_NAMES[settings.mirror]} (K)`;
  setButtonOn('bKal', settings.mirror > 0);
}

export function renderReactivity() {
  $('rv').textContent = settings.reactivity.toFixed(1);
}

export function syncUI() {
  renderModeButton();
  renderPaletteButton();
  renderPsyButton();
  renderMirrorButton();
  setButtonOn('bFb', settings.trails);
  setButtonOn('bLas', settings.lasers);
  setButtonOn('bGl', settings.glitch);
  setButtonOn('bStb', settings.strobe);
  setButtonOn('bAgc', settings.autoGain);
  setButtonOn('bAuto', settings.auto);
  $('gain').value = settings.gain;
  $('react').value = settings.reactivity;
  renderReactivity();
}
