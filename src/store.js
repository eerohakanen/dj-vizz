import { useSyncExternalStore } from 'react';

const listeners = new Set();
let version = 0;

export const ui = {
  controlsHidden: false,
  overlay: null,
  paused: false,
  live: false,
};

export function notify() {
  version++;
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useEngine = () => useSyncExternalStore(subscribe, () => version);
