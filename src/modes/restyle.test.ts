import { afterEach, describe, expect, it, vi } from 'vitest';
import { clock } from '../state';
import { glideStyle, nextVariant } from './restyle';

describe('nextVariant', () => {
  afterEach(() => vi.restoreAllMocks());

  it('never returns the current variant and stays in range', () => {
    for (const count of [2, 3, 4, 6]) {
      for (let current = 0; current < count; current++) {
        for (const strength of [0, 0.3, 0.55, 0.8, 1]) {
          for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
            vi.spyOn(Math, 'random').mockReturnValue(roll);
            const next = nextVariant(current, count, strength);
            expect(next).not.toBe(current);
            expect(next).toBeGreaterThanOrEqual(0);
            expect(next).toBeLessThan(count);
          }
        }
      }
    }
  });

  it('steps to the neighbour on a plain phrase', () => {
    for (const roll of [0, 0.5, 0.999]) {
      vi.spyOn(Math, 'random').mockReturnValue(roll);
      expect(nextVariant(2, 6, 0.3)).toBe(3);
      expect(nextVariant(5, 6, 0.3)).toBe(0);
    }
  });

  it('can jump further on a strong phrase', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(nextVariant(0, 6, 0.9)).toBe(5);
  });
});

describe('glideStyle', () => {
  const initialDelta = clock.delta;

  afterEach(() => {
    clock.delta = initialDelta;
  });

  it('moves every key toward the target', () => {
    clock.delta = 1 / 60;
    const style = { a: 0, b: 10 };
    glideStyle(style, { a: 1, b: 0 });
    expect(style.a).toBeGreaterThan(0);
    expect(style.a).toBeLessThan(1);
    expect(style.b).toBeLessThan(10);
    expect(style.b).toBeGreaterThan(0);
  });

  it('reaches the target over time', () => {
    clock.delta = 1 / 60;
    const style = { a: 0, b: 10 };
    for (let frame = 0; frame < 600; frame++) glideStyle(style, { a: 1, b: 0 });
    expect(style.a).toBeCloseTo(1, 5);
    expect(style.b).toBeCloseTo(0, 5);
  });

  it('leaves keys outside the target untouched', () => {
    clock.delta = 1 / 60;
    const style = { a: 0, morph: 0.5 };
    glideStyle(style, { a: 1 });
    expect(style.morph).toBe(0.5);
  });
});
