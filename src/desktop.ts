import type { DesktopBridge } from '../electron/bridge';

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export const desktop = typeof window === 'undefined' ? undefined : window.desktop;

export const isDesktop = !!desktop;
