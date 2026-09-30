import type { TuningGroup } from '../tuning';

export const CHANGE_OPTIONS = [
  { value: 'drop', label: 'On each drop' },
  { value: 'b16', label: 'Every 16 beats' },
  { value: 'b32', label: 'Every 32 beats' },
  { value: 's15', label: 'Every 15 s' },
  { value: 's30', label: 'Every 30 s' },
  { value: 's60', label: 'Every 60 s' },
];

export const SOURCE_LABELS: Record<string, string> = { mic: 'Microphone', window: 'Window audio' };

export const TUNING_GROUP_NOTES: Record<TuningGroup, string> = {
  calibration: 'Remembered on this device.',
  look: 'Saved with presets.',
};
