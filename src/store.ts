import { useSyncExternalStore } from 'react';

export type Overlay = 'exit' | 'help' | 'presets';

const listeners = new Set<() => void>();
let version = 0;

export const ui = {
  controlsHidden: false,
  hideLocked: false,
  peek: false,
  overlay: null as Overlay | null,
  paused: false,
  live: false,
};

export function notify() {
  version++;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useEngine = () => useSyncExternalStore(subscribe, () => version);
