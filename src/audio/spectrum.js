export const BAND_COUNT = 96;

export const spectrum = new Float32Array(BAND_COUNT);

export const bandAt = (index, count) => spectrum[Math.min(BAND_COUNT - 1, ((index / count) * BAND_COUNT) | 0)];
