export interface DesktopBridge {
  holdAwake(awake: boolean): void;
}

export const CHANNELS = {
  holdAwake: 'desktop:hold-awake',
} as const;
