import { startTransition, type TransitionKind } from './effects/transition';
import { wrap } from './math';
import { MODES } from './modes/index';
import { resetRings } from './modes/tunnel';
import { settings } from './state';
import { notify } from './store';

export const currentMode = () => MODES[settings.mode];

export function setMode(index: number, transition?: TransitionKind) {
  startTransition(transition);
  settings.mode = wrap(index, MODES.length);
  resetRings();
  notify();
}
