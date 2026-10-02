import { describe, expect, it, vi } from 'vitest';
import { brightness, DENSITY_RAMP, glyphIndex } from './ascii';

vi.mock('./canvas', () => ({ createCanvas: vi.fn() }));

describe('glyphIndex', () => {
  it('never decreases as the level rises', () => {
    let previous = 0;
    for (let level = 0; level <= 1; level += 0.01) {
      const index = glyphIndex(level, DENSITY_RAMP.length);
      expect(index).toBeGreaterThanOrEqual(previous);
      previous = index;
    }
  });

  it('stays inside the ramp for out-of-range levels', () => {
    expect(glyphIndex(-0.5, DENSITY_RAMP.length)).toBe(0);
    expect(glyphIndex(1, DENSITY_RAMP.length)).toBe(DENSITY_RAMP.length - 1);
    expect(glyphIndex(3, DENSITY_RAMP.length)).toBe(DENSITY_RAMP.length - 1);
  });
});

describe('brightness', () => {
  it('reads saturated colours as bright', () => {
    expect(brightness(0, 0, 255)).toBe(1);
    expect(brightness(0, 0, 0)).toBe(0);
  });
});
