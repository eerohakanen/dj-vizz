import { isNumber, isRecord } from './lib/utils';
import { clamp } from './math';
import { settings, TUNING_DEFAULTS } from './state';
import { MODE_CONTROLS, type ModeTuningKey } from './tuning';

export type ModeTuning = Record<ModeTuningKey, number>;

export const modeTuning: Record<string, ModeTuning> = {};

const pickModeTuning = (source: Partial<Record<ModeTuningKey, unknown>>): ModeTuning =>
  Object.fromEntries(
    MODE_CONTROLS.map(({ key, min, max }) => {
      const value = source[key];
      return [key, isNumber(value) ? clamp(value, min, max) : TUNING_DEFAULTS[key]];
    }),
  ) as ModeTuning;

export const modeTuningFor = (mode: string) => modeTuning[mode] ?? pickModeTuning({});

export const captureModeTuning = (mode: string) => {
  modeTuning[mode] = pickModeTuning(settings);
};

export const applyModeTuning = (mode: string) => Object.assign(settings, modeTuningFor(mode));

export function restoreModeTuning(stored: Record<string, unknown>) {
  for (const [mode, values] of Object.entries(stored)) {
    if (isRecord(values)) modeTuning[mode] = pickModeTuning(values);
  }
}
