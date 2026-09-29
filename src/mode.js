import { startTransition } from './effects/transition.js';
import { MODES } from './modes/index.js';
import { resetRings } from './modes/tunnel.js';
import { settings } from './state.js';
import { notify } from './store.js';

export const currentMode = () => MODES[settings.mode];

export function setMode(index) {
  startTransition();
  settings.mode = (index + MODES.length) % MODES.length;
  resetRings();
  notify();
}
