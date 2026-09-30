import { describe, expect, it } from 'vitest';
import { findTrigger } from './trigger';

const buffer = (values: number[], length = 16) => Uint8Array.from({ length }, (_, i) => values[i] ?? 100);

describe('findTrigger', () => {
  it('returns the first rising zero crossing', () => {
    expect(findTrigger(buffer([100, 110, 120, 130, 140]))).toBe(3);
  });

  it('skips falling crossings', () => {
    expect(findTrigger(buffer([140, 130, 120, 110, 120, 128]))).toBe(5);
  });

  it('ignores crossings in the second half', () => {
    expect(findTrigger(buffer([100, 100, 100, 100, 100, 100, 100, 100, 100, 130]))).toBe(0);
  });

  it('returns 0 for silence and flat signals', () => {
    expect(findTrigger(new Uint8Array(16).fill(128))).toBe(0);
    expect(findTrigger(new Uint8Array(16).fill(100))).toBe(0);
  });

  it('aligns phase-shifted sine waves on the same waveform point', () => {
    const sine = (shift: number) => Uint8Array.from({ length: 256 }, (_, i) => Math.round(128 + 100 * Math.sin(((i + shift) / 64) * Math.PI * 2)));
    const first = sine(3);
    const second = sine(20);
    const a = findTrigger(first);
    const b = findTrigger(second);
    expect(a).not.toBe(b);
    expect(Array.from(first.subarray(a, a + 32))).toEqual(Array.from(second.subarray(b, b + 32)));
  });
});
