export const MARK_SIZE = 64;
export const MARK_FRAME_INSET = 1.5;
export const MARK_FRAME_WIDTH = 3;
export const MARK_BAR_WIDTH = 5;
export const MARK_BARS = [
  { x: 12, top: 29, bottom: 35 },
  { x: 22, top: 21, bottom: 43 },
  { x: 32, top: 13, bottom: 51, live: true },
  { x: 42, top: 23, bottom: 41 },
  { x: 52, top: 27, bottom: 37 },
];

export const markBarPath = ({ x, top, bottom }: (typeof MARK_BARS)[number]) => `M${x} ${top}v${bottom - top}`;

export function markSvg(liveColor: string) {
  const frameSize = MARK_SIZE - MARK_FRAME_INSET * 2;
  const bars = MARK_BARS.map(
    (bar) =>
      `<path d="${markBarPath(bar)}" stroke="${bar.live ? liveColor : '#000000'}" stroke-width="${MARK_BAR_WIDTH}" fill="none"/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK_SIZE} ${MARK_SIZE}"><rect x="${MARK_FRAME_INSET}" y="${MARK_FRAME_INSET}" width="${frameSize}" height="${frameSize}" fill="#ffffff" stroke="#000000" stroke-width="${MARK_FRAME_WIDTH}"/>${bars}</svg>`;
}

export const markDataUrl = (liveColor: string) => `data:image/svg+xml,${encodeURIComponent(markSvg(liveColor))}`;
