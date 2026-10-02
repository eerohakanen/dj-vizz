import { describe, expect, it } from 'vitest';
import { frameAt, gridPosition, loopBeatsFor, stepPlayhead, tempoScale } from './playhead';

describe('loopBeatsFor', () => {
  it('snaps the native loop length to the nearest power-of-two beat count', () => {
    expect(loopBeatsFor(0.88, 128)).toBe(2);
    expect(loopBeatsFor(1.9, 128)).toBe(4);
  });

  it('keeps the loop between one and eight beats', () => {
    expect(loopBeatsFor(0.1, 90)).toBe(1);
    expect(loopBeatsFor(30, 174)).toBe(8);
  });
});

describe('gridPosition', () => {
  it('maps the beat clock onto the loop', () => {
    expect(gridPosition(0, 0, 2)).toBe(0);
    expect(gridPosition(1, 0.5, 2)).toBe(0.75);
    expect(gridPosition(2, 0, 2)).toBe(0);
    expect(gridPosition(0, 0.25, 0.5)).toBe(0.5);
  });
});

describe('stepPlayhead', () => {
  it('advances by rate and wraps without a target', () => {
    expect(stepPlayhead(0.9, 1, 0.2)).toBeCloseTo(0.1);
  });

  it('eases toward the beat grid instead of jumping', () => {
    const next = stepPlayhead(0.2, 0, 0.1, 0.6);
    expect(next).toBeGreaterThan(0.2);
    expect(next).toBeLessThan(0.6);
  });

  it('takes the short way around the loop', () => {
    const next = stepPlayhead(0.95, 0, 0.1, 0.05);
    expect(next).toBeGreaterThan(0.95);
  });
});

describe('tempoScale', () => {
  it('doubles on a drop and holds until the drop fades', () => {
    expect(tempoScale(1, 0.7, 0)).toBe(2);
    expect(tempoScale(2, 0.4, 0)).toBe(2);
    expect(tempoScale(2, 0.1, 0)).toBe(1);
  });

  it('halves in a breakdown and holds until it lifts', () => {
    expect(tempoScale(1, 0, 0.8)).toBe(0.5);
    expect(tempoScale(0.5, 0, 0.5)).toBe(0.5);
    expect(tempoScale(0.5, 0, 0.2)).toBe(1);
  });

  it('stays at normal speed between thresholds', () => {
    expect(tempoScale(1, 0.4, 0.5)).toBe(1);
  });
});

describe('frameAt', () => {
  it('follows the frame delays across the loop', () => {
    const delays = [0.1, 0.2, 0.1];
    expect(frameAt(0.1, delays)).toBe(0);
    expect(frameAt(0.5, delays)).toBe(1);
    expect(frameAt(0.9, delays)).toBe(2);
    expect(frameAt(1.1, delays)).toBe(0);
  });
});
