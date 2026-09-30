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

  it('keeps a full half buffer available after the trigger', () => {
    const wave = Uint8Array.from({ length: 32 }, (_, i) => (i % 8 < 4 ? 100 : 160));
    expect(findTrigger(wave) + 16).toBeLessThanOrEqual(wave.length);
  });
});
