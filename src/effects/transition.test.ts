import { describe, expect, it, vi } from 'vitest';

vi.mock('../canvas', () => ({ output: {}, transitionCtx: {}, transitionFrame: {} }));

import { transitionDuration, transitionStyle } from './transition';

describe('transitionDuration', () => {
  it('keeps the default when tempo is not locked', () => {
    expect(transitionDuration(0)).toBe(1.1);
  });

  it('lasts one bar when locked', () => {
    expect(transitionDuration(120)).toBeCloseTo(2);
  });

  it('clamps very slow and very fast tempos', () => {
    expect(transitionDuration(60)).toBe(2.4);
    expect(transitionDuration(300)).toBe(0.8);
    expect(transitionDuration(500)).toBe(0.6);
  });
});

describe('transitionStyle', () => {
  it('picks one of the four random styles', () => {
    expect(transitionStyle(false, 0)).toBe(0);
    expect(transitionStyle(false, 0.99)).toBe(3);
    expect(transitionStyle(false, 1)).toBe(3);
  });

  it('only crossfades when motion is reduced', () => {
    expect(transitionStyle(true, 0)).toBe(4);
    expect(transitionStyle(true, 0.99)).toBe(4);
  });
});
