const OPTIONS = [
  { value: 'drop', label: 'On each drop' },
  { value: 'b16', label: 'Every 16 beats', beats: 16 },
  { value: 'b32', label: 'Every 32 beats', beats: 32 },
  { value: 's15', label: 'Every 15 s', seconds: 15 },
  { value: 's30', label: 'Every 30 s', seconds: 30 },
  { value: 's60', label: 'Every 60 s', seconds: 60 },
] as const;

export type ChangeOn = (typeof OPTIONS)[number]['value'];

export interface ChangeOption {
  value: ChangeOn;
  label: string;
  beats?: number;
  seconds?: number;
}

export const CHANGE_OPTIONS: readonly ChangeOption[] = OPTIONS;

export const DEFAULT_CHANGE_ON: ChangeOn = 'b32';

export const findChangeOption = (value: unknown) => CHANGE_OPTIONS.find((option) => option.value === value);

export const changeOption = (value: ChangeOn) => findChangeOption(value)!;
