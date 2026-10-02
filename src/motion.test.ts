import { afterEach, describe, expect, it } from 'vitest';
import { comfort, motionScale, REDUCED_MOTION_SCALE, shakeLevel } from './motion';
import { settings } from './state';

afterEach(() => {
  comfort.reduced = false;
  settings.punch = 1;
});

describe('reduced motion', () => {
  it('leaves shake alone by default', () => {
    settings.punch = 1.5;
    expect(motionScale()).toBe(1);
    expect(shakeLevel()).toBeCloseTo(1.5);
  });

  it('scales shake down without touching settings', () => {
    comfort.reduced = true;
    settings.punch = 1;
    expect(REDUCED_MOTION_SCALE).toBeLessThanOrEqual(0.3);
    expect(shakeLevel()).toBeLessThanOrEqual(0.3);
    expect(settings.punch).toBe(1);
  });
});
