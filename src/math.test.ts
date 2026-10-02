import { afterEach, describe, expect, it, vi } from 'vitest';
import { approach, clamp, clamp01, decay, follow, frameAlpha, hueDelta, keepNewest, lerp, quantize, randomRange, signedRandom, smoothstep, stretch, updatePeak, wrap } from './math';

afterEach(() => vi.restoreAllMocks());

describe('clamp', () => {
  it('keeps values inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('limits values at both bounds', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it('clamp01 limits to the unit interval', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(1.5)).toBe(1);
  });
});

describe('lerp', () => {
  it('interpolates between the endpoints', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });

  it('extrapolates outside the unit interval', () => {
    expect(lerp(0, 10, 2)).toBe(20);
  });
});

describe('approach', () => {
  it('moves a fraction of the way toward the target', () => {
    expect(approach(0, 10, 2, 0.25)).toBe(5);
  });

  it('stays put when delta is zero', () => {
    expect(approach(3, 10, 4, 0)).toBe(3);
  });

  it('clamps at the target when delta times rate exceeds one', () => {
    expect(approach(0, 10, 5, 10)).toBe(10);
  });

  it('approaches downward as well', () => {
    expect(approach(10, 0, 1, 0.5)).toBe(5);
  });
});

describe('decay', () => {
  it('is the identity for zero delta', () => {
    expect(decay(0.25, 0)).toBe(1);
  });

  it('applies the factor once per unit of time', () => {
    expect(decay(0.25, 1)).toBe(0.25);
    expect(decay(0.25, 2)).toBe(0.0625);
  });

  it('composes across split frames', () => {
    expect(decay(0.02, 0.1) * decay(0.02, 0.1)).toBeCloseTo(decay(0.02, 0.2));
  });
});

describe('smoothstep', () => {
  it('fixes the endpoints and midpoint', () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBe(0.5);
  });

  it('eases in slower than linear near the start', () => {
    expect(smoothstep(0.25)).toBeCloseTo(0.15625);
  });
});

describe('wrap', () => {
  it('leaves in-range values unchanged', () => {
    expect(wrap(3, 5)).toBe(3);
  });

  it('wraps values past the end', () => {
    expect(wrap(5, 5)).toBe(0);
    expect(wrap(12, 5)).toBe(2);
  });

  it('wraps negatives into the positive range', () => {
    expect(wrap(-1, 5)).toBe(4);
    expect(wrap(-11, 5)).toBe(4);
  });

  it('wraps fractional values', () => {
    expect(wrap(-30, 360)).toBe(330);
    expect(wrap(725.5, 360)).toBeCloseTo(5.5);
  });
});

describe('hueDelta', () => {
  it('is zero for equal hues', () => {
    expect(hueDelta(120, 120)).toBe(0);
  });

  it('takes the short way across the 0/360 seam', () => {
    expect(hueDelta(350, 10)).toBe(20);
    expect(hueDelta(10, 350)).toBe(-20);
  });

  it('is signed within the same turn', () => {
    expect(hueDelta(100, 160)).toBe(60);
    expect(hueDelta(160, 100)).toBe(-60);
  });

  it('stays within [-180, 180)', () => {
    expect(hueDelta(0, 180)).toBe(-180);
    expect(hueDelta(0, 181)).toBe(-179);
  });

  it('handles hues outside one turn', () => {
    expect(hueDelta(0, 730)).toBe(10);
    expect(hueDelta(720, -10)).toBe(-10);
  });
});

describe('random helpers', () => {
  it('randomRange maps the unit random into the range', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.5).mockReturnValueOnce(0.999);
    expect(randomRange(-2, 6)).toBe(-2);
    expect(randomRange(-2, 6)).toBe(2);
    expect(randomRange(-2, 6)).toBeCloseTo(5.992);
  });

  it('signedRandom is centered on zero and scaled', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.5).mockReturnValueOnce(1);
    expect(signedRandom(10)).toBe(-5);
    expect(signedRandom(10)).toBe(0);
    expect(signedRandom(10)).toBe(5);
  });

  it('stays within bounds for real random values', () => {
    for (let i = 0; i < 200; i++) {
      const range = randomRange(3, 4);
      const signed = signedRandom(2);
      expect(range).toBeGreaterThanOrEqual(3);
      expect(range).toBeLessThan(4);
      expect(signed).toBeGreaterThanOrEqual(-1);
      expect(signed).toBeLessThan(1);
    }
  });
});

describe('follow', () => {
  const run = (start: number, target: number, fps: number, seconds: number, attack = 0.03, release = 0.18) => {
    let value = start;
    for (let i = 0; i < Math.round(fps * seconds); i++) value = follow(value, target, attack, release, 1 / fps);
    return value;
  };

  it('rises with the same result at 60 and 120 Hz', () => {
    expect(run(0, 1, 60, 0.1)).toBeCloseTo(run(0, 1, 120, 0.1), 6);
  });

  it('falls with the same result at 60 and 120 Hz', () => {
    expect(run(1, 0, 60, 0.1)).toBeCloseTo(run(1, 0, 120, 0.1), 6);
  });

  it('attacks faster than it releases', () => {
    expect(run(0, 1, 60, 0.05)).toBeGreaterThan(1 - run(1, 0, 60, 0.05));
  });

  it('never overshoots the target', () => {
    expect(follow(0, 1, 0.03, 0.18, 10)).toBeLessThanOrEqual(1);
    expect(follow(1, 0, 0.03, 0.18, 10)).toBeGreaterThanOrEqual(0);
  });
});

describe('frameAlpha', () => {
  it('matches the reference alpha at 60 Hz', () => {
    expect(frameAlpha(0.13, 1 / 60)).toBeCloseTo(0.13, 10);
  });

  it('accumulates the same fade over equal time at 120 Hz', () => {
    const at60 = Math.pow(1 - frameAlpha(0.13, 1 / 60), 6);
    const at120 = Math.pow(1 - frameAlpha(0.13, 1 / 120), 12);
    expect(at120).toBeCloseTo(at60, 10);
  });
});

describe('updatePeak', () => {
  it('jumps up to a higher level immediately', () => {
    expect(updatePeak(0.2, 0.9, 0.5, 1 / 60)).toBe(0.9);
  });

  it('falls at the given rate per second', () => {
    expect(updatePeak(1, 0, 0.5, 0.5)).toBeCloseTo(0.75, 10);
  });

  it('never falls below the current level', () => {
    expect(updatePeak(0.5, 0.4, 0.5, 10)).toBe(0.4);
  });

  it('falls the same amount over equal time at 60 and 120 Hz', () => {
    let at60 = 1;
    let at120 = 1;
    for (let i = 0; i < 30; i++) at60 = updatePeak(at60, 0, 0.6, 1 / 60);
    for (let i = 0; i < 60; i++) at120 = updatePeak(at120, 0, 0.6, 1 / 120);
    expect(at120).toBeCloseTo(at60, 10);
  });
});

describe('keepNewest', () => {
  it('drops the oldest items above the max', () => {
    const items = [1, 2, 3, 4, 5];
    keepNewest(items, 3);
    expect(items).toEqual([3, 4, 5]);
  });

  it('leaves shorter lists untouched', () => {
    const items = [1, 2];
    keepNewest(items, 3);
    expect(items).toEqual([1, 2]);
  });
});

describe('quantize', () => {
  it('rounds to the nearest step', () => {
    expect(quantize(100.2, 0.5)).toBe(100);
    expect(quantize(100.3, 0.5)).toBe(100.5);
    expect(quantize(0.3, 1 / 4)).toBe(0.25);
  });
});

describe('stretch', () => {
  it('maps the floor to zero and the peak to one', () => {
    expect(stretch(0.3, 0.3, 0.5, 0.1)).toBe(0);
    expect(stretch(0.5, 0.3, 0.5, 0.1)).toBe(1);
  });

  it('expands a small change inside a narrow range', () => {
    expect(stretch(0.4, 0.3, 0.5, 0.1)).toBeCloseTo(0.5, 10);
  });

  it('never divides by a range narrower than the minimum', () => {
    expect(stretch(0.31, 0.3, 0.3, 0.1)).toBeCloseTo(0.1, 10);
  });

  it('stays inside the unit interval', () => {
    expect(stretch(0.1, 0.3, 0.5, 0.1)).toBe(0);
    expect(stretch(0.9, 0.3, 0.5, 0.1)).toBe(1);
  });
});
