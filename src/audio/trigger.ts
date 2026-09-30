const ZERO = 128;

export function findTrigger(waveform: Uint8Array) {
  const limit = waveform.length >> 1;
  for (let i = 1; i < limit; i++) if (waveform[i - 1] < ZERO && waveform[i] >= ZERO) return i;
  return 0;
}
