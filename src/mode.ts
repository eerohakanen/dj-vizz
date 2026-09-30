import { startTransition } from './effects/transition';
import { MODES } from './modes/index';
import { resetRings } from './modes/tunnel';
import { settings } from './state';
import { notify } from './store';

export const currentMode = () => MODES[settings.mode];

export function setMode(index: number) {
  startTransition();
  settings.mode = (index + MODES.length) % MODES.length;
  resetRings();
  notify();
}
