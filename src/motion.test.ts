import { afterEach, describe, expect, it } from 'vitest';
import { allowStrobe, comfort, flashLevel, motionScale, REDUCED_MOTION_SCALE, shakeLevel, strobeActive } from './motion';
import { settings } from './state';

afterEach(() => {
  comfort.reduced = false;
  comfort.strobeOptIn = false;
  settings.strobe = false;
  settings.flashes = 1;
  settings.punch = 1;
});

describe('reduced motion', () => {
  it('leaves flashes and shake alone by default', () => {
    settings.flashes = 0.8;
    settings.punch = 1.5;
    expect(motionScale()).toBe(1);
    expect(flashLevel()).toBeCloseTo(0.8);
    expect(shakeLevel()).toBeCloseTo(1.5);
  });

  it('scales flashes and shake down without touching settings', () => {
    comfort.reduced = true;
    settings.flashes = 1;
    settings.punch = 1;
    expect(REDUCED_MOTION_SCALE).toBeLessThanOrEqual(0.3);
    expect(flashLevel()).toBeLessThanOrEqual(0.3);
    expect(shakeLevel()).toBeLessThanOrEqual(0.3);
    expect(settings.flashes).toBe(1);
  });

  it('keeps strobe off until the user turns it on', () => {
    comfort.reduced = true;
    settings.strobe = true;
    expect(strobeActive()).toBe(false);
    allowStrobe();
    expect(strobeActive()).toBe(true);
  });

  it('strobes normally when motion is not reduced', () => {
    settings.strobe = true;
    expect(strobeActive()).toBe(true);
  });
});

describe('strobe opt-in', () => {
  it('shows a suppressed strobe as off and lets one toggle turn it on', async () => {
    const { effectEnabled, revokeStrobe } = await import('./motion');
    comfort.reduced = true;
    settings.strobe = true;
    expect(effectEnabled('strobe')).toBe(false);
    allowStrobe();
    expect(effectEnabled('strobe')).toBe(true);
    revokeStrobe();
    expect(effectEnabled('strobe')).toBe(false);
  });
});
