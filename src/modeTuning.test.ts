import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetModeTuning, setSetting } from './actions';
import { setMode } from './mode';
import { modeTuning } from './modeTuning';
import { settings, TUNING_DEFAULTS } from './state';

vi.mock('./canvas', () => ({ output: {}, transitionCtx: {}, transitionFrame: {} }));
vi.mock('./modes/index', () => ({ MODES: Array.from({ length: 3 }, (_, index) => ({ name: `Mode ${index}` })) }));
vi.mock('./modes/tunnel', () => ({ resetRings: vi.fn() }));
vi.mock('./effects/transition', async (importOriginal) => ({ ...(await importOriginal<object>()), startTransition: vi.fn() }));
vi.mock('./color', () => ({ setPalette: vi.fn() }));

beforeEach(() => {
  for (const mode of Object.keys(modeTuning)) delete modeTuning[mode];
  Object.assign(settings, TUNING_DEFAULTS, { mode: 0 });
});

describe('per-mode tuning', () => {
  it('keeps each mode its own motion, punch and colour speed', () => {
    setSetting('motion', 1.8);
    setSetting('punch', 0.3);
    setMode(1);
    expect(settings).toMatchObject({ motion: TUNING_DEFAULTS.motion, punch: TUNING_DEFAULTS.punch });
    setSetting('motion', 0.4);
    setMode(0);
    expect(settings).toMatchObject({ motion: 1.8, punch: 0.3 });
    setMode(1);
    expect(settings.motion).toBe(0.4);
  });

  it('shares global tuning across modes', () => {
    setSetting('reactivity', 2.4);
    setSetting('pixelSize', 30);
    setMode(2);
    expect(settings).toMatchObject({ reactivity: 2.4, pixelSize: 30 });
  });

  it('resets only the current mode', () => {
    setSetting('motion', 1.8);
    setMode(1);
    setSetting('motion', 0.4);
    setSetting('reactivity', 2.4);
    resetModeTuning();
    expect(settings).toMatchObject({ motion: TUNING_DEFAULTS.motion, reactivity: 2.4 });
    setMode(0);
    expect(settings.motion).toBe(1.8);
  });
});
