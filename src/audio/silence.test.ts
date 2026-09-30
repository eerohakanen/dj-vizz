import { describe, expect, it } from 'vitest';
import { SILENCE_LEVEL, SILENCE_MS, trackSilence, type SilenceTracker } from './silence';

const quiet = SILENCE_LEVEL / 2;
const loud = SILENCE_LEVEL * 10;

describe('trackSilence', () => {
  it('warns only after the silence has lasted longer than the limit', () => {
    const tracker: SilenceTracker = { since: null };
    expect(trackSilence(tracker, true, quiet, 1000)).toBe(false);
    expect(trackSilence(tracker, true, quiet, 1000 + SILENCE_MS)).toBe(false);
    expect(trackSilence(tracker, true, quiet, 1001 + SILENCE_MS)).toBe(true);
  });

  it('clears as soon as sound returns and restarts the clock', () => {
    const tracker: SilenceTracker = { since: null };
    trackSilence(tracker, true, quiet, 0);
    expect(trackSilence(tracker, true, quiet, 6000)).toBe(true);
    expect(trackSilence(tracker, true, loud, 6100)).toBe(false);
    expect(trackSilence(tracker, true, quiet, 6200)).toBe(false);
    expect(trackSilence(tracker, true, quiet, 6200 + SILENCE_MS)).toBe(false);
  });

  it('never warns while not live', () => {
    const tracker: SilenceTracker = { since: null };
    trackSilence(tracker, false, quiet, 0);
    expect(trackSilence(tracker, false, quiet, 60000)).toBe(false);
    expect(tracker.since).toBeNull();
  });
});
