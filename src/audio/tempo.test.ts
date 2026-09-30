import { describe, expect, it } from 'vitest';
import { barPhaseAt, beatPhaseAt } from './tempo';

describe('beatPhaseAt', () => {
  it('is 0 one period before the next beat', () => {
    expect(beatPhaseAt(1, 1.5, 0.5)).toBeCloseTo(0);
  });

  it('is halfway half a period before the next beat', () => {
    expect(beatPhaseAt(1.25, 1.5, 0.5)).toBeCloseTo(0.5);
  });

  it('reaches 1 at the next beat', () => {
    expect(beatPhaseAt(1.5, 1.5, 0.5)).toBeCloseTo(1);
  });

  it('clamps just after a beat fired early', () => {
    expect(beatPhaseAt(0.98, 1.5, 0.5)).toBe(0);
    expect(beatPhaseAt(2, 1.5, 0.5)).toBe(1);
  });
});

describe('barPhaseAt', () => {
  it('spans a bar over four beats', () => {
    expect(barPhaseAt(0, 0)).toBe(0);
    expect(barPhaseAt(1, 0)).toBe(0.25);
    expect(barPhaseAt(2, 0.5)).toBeCloseTo(0.625);
    expect(barPhaseAt(3, 1)).toBe(1);
  });
});
