import { MicIcon, MonitorSpeaker, type LucideIcon } from 'lucide-react';
import { WINDOW_UNSUPPORTED, canCaptureWindow, captureMicrophone, captureWindow } from '@/audio/input';
import type { AudioSourceKind } from '@/audio/sources';
import type { TuningGroup } from '@/tuning';

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
