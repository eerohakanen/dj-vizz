import { useSyncExternalStore } from 'react';

export type Screen = 'landing' | 'presets' | 'setup' | 'live';
export type LiveMode = 'explore' | 'play' | 'edit';
export type Overlay = 'exit' | 'help' | 'scenes' | 'tuning';

const listeners = new Set<() => void>();
let version = 0;

export const ui = {
  controlsHidden: false,
  hideLocked: false,
  peek: false,
  overlay: null as Overlay | null,
  paused: false,
  fullscreen: false,
  screen: 'landing' as Screen,
  liveMode: 'explore' as LiveMode,
  debug: false,
};

export function notify() {
  version++;
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useEngine = () => useSyncExternalStore(subscribe, () => version);
