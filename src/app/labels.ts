import { MicIcon, MonitorSpeaker, type LucideIcon } from 'lucide-react';
import {
  WINDOW_UNSUPPORTED,
  canCaptureWindow,
  captureMicrophone,
  captureWindow,
  type AudioSourceKind,
} from '@/audio/input';
import type { TuningGroup } from '@/tuning';

export const CHANGE_OPTIONS = [
  { value: 'drop', label: 'On each drop' },
  { value: 'b16', label: 'Every 16 beats' },
  { value: 'b32', label: 'Every 32 beats' },
  { value: 's15', label: 'Every 15 s' },
  { value: 's30', label: 'Every 30 s' },
  { value: 's60', label: 'Every 60 s' },
];

interface SourceOption {
  kind: AudioSourceKind;
  label: string;
  icon: LucideIcon;
  description: string;
  unsupported?: string;
  capture: typeof captureWindow;
}

export const SOURCES: readonly SourceOption[] = [
  {
    kind: 'window',
    label: 'Window audio',
    icon: MonitorSpeaker,
    description: 'Share a tab, window or your entire screen. Turn on "Share audio" in the picker.',
    unsupported: canCaptureWindow ? undefined : WINDOW_UNSUPPORTED,
    capture: captureWindow,
  },
  {
    kind: 'mic',
    label: 'Microphone',
    icon: MicIcon,
    description: 'Listen to the room through your mic or an audio interface.',
    capture: captureMicrophone,
  },
];

export const sourceLabel = (kind: AudioSourceKind | null) => SOURCES.find((source) => source.kind === kind)?.label;

export const TUNING_GROUP_NOTES: Record<TuningGroup, string> = {
  calibration: 'Remembered on this device.',
  look: 'Saved with presets.',
};
