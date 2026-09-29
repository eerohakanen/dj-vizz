import { $ } from './dom.js';
import { startTransition } from './effects/transition.js';
import { MODES } from './modes/index.js';
import { resetRings } from './modes/tunnel.js';
import { settings } from './state.js';

export const currentMode = () => MODES[settings.mode];

export function renderModeButton() {
  $('bMode').textContent = `Mode: ${currentMode().name}`;
}

export function setMode(index) {
  startTransition();
  settings.mode = (index + MODES.length) % MODES.length;
  renderModeButton();
  resetRings();
}
