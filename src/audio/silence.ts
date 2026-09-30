export const SILENCE_LEVEL = 0.01;
export const SILENCE_MS = 5000;

export interface SilenceTracker {
  since: number | null;
}

export function trackSilence(tracker: SilenceTracker, live: boolean, level: number, now: number) {
  tracker.since = live && level < SILENCE_LEVEL ? (tracker.since ?? now) : null;
  return tracker.since !== null && now - tracker.since > SILENCE_MS;
}
