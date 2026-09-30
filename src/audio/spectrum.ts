export const BAND_COUNT = 96;

export const spectrum = new Float32Array(BAND_COUNT);

export function averageBins(frequencies: Uint8Array, from: number, to: number) {
  let sum = 0;
  for (let i = from; i < to; i++) sum += frequencies[i];
  return sum / (to - from) / 255;
}

export const bandAt = (index: number, count: number) => spectrum[Math.min(BAND_COUNT - 1, ((index / count) * BAND_COUNT) | 0)];
