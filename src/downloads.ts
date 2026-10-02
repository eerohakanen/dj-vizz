const LATEST_RELEASE = 'https://github.com/eerohakanen/dj-vizz/releases/latest/download';

export const DOWNLOADS = [
  { platform: 'windows', label: 'Download for Windows', url: `${LATEST_RELEASE}/DJ-Visualizer-windows.exe` },
] as const;

const MOBILE = /Android|iPhone|iPad|iPod|Mobile/;

export function downloadsFor(userAgent: string) {
  if (MOBILE.test(userAgent)) return [];
  return [...DOWNLOADS];
}
