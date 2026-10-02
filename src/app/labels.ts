import { MicIcon, MonitorSpeaker, type LucideIcon } from 'lucide-react';
import { WINDOW_UNSUPPORTED, canCaptureWindow, captureMicrophone, captureWindow } from '@/audio/input';
import type { AudioSourceKind } from '@/audio/sources';
import { isDesktop } from '@/desktop';
import type { MenuScreen } from '@/actions';
import type { TuningGroup } from '@/tuning';

export interface SourceOption {
  kind: AudioSourceKind;
  label: string;
  icon: LucideIcon;
  description: string;
  unsupported?: string;
  capture: typeof captureWindow;
}

const BROWSER_WINDOW_SOURCE = {
  label: 'Window audio',
  description: 'Share a tab, window or your entire screen. Turn on "Share audio" in the picker.',
  unsupported: canCaptureWindow ? undefined : WINDOW_UNSUPPORTED,
};

const DESKTOP_WINDOW_SOURCE = {
  label: 'System audio',
  description: 'Listen to everything playing on this computer.',
};

export const SOURCES: readonly SourceOption[] = [
  {
    kind: 'window',
    icon: MonitorSpeaker,
    capture: captureWindow,
    ...(isDesktop ? DESKTOP_WINDOW_SOURCE : BROWSER_WINDOW_SOURCE),
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
  global: 'Remembered on this device for every mode.',
  mode: 'Remembered separately for each mode.',
};

export const MENU_SCREEN_LABELS: Record<MenuScreen, string> = {
  landing: 'Home',
  presets: 'My presets',
  setup: 'Connect audio',
};
