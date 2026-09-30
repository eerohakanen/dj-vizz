import { view } from './state';

export const BACKGROUND = '#05050a';

export function createCanvas(width?: number, height?: number) {
  const canvas = document.createElement('canvas');
  if (width) {
    canvas.width = width;
    canvas.height = height || width;
  }
  return canvas;
}

function findOutput() {
  const element = document.getElementById('cv');
  if (!(element instanceof HTMLCanvasElement)) throw new Error('Missing output canvas');
  return element;
}

export const output = findOutput();
export const outputCtx = output.getContext('2d', { alpha: false })!;
export const scene = createCanvas();
export const sceneCtx = scene.getContext('2d', { alpha: false })!;
export const kaleidoBuffer = createCanvas();
export const kaleidoCtx = kaleidoBuffer.getContext('2d')!;
export const transitionFrame = createCanvas();
export const transitionCtx = transitionFrame.getContext('2d')!;
export const bloomLevels = [createCanvas(), createCanvas(), createCanvas(), createCanvas()];
export const bloomContexts = bloomLevels.map((canvas) => canvas.getContext('2d')!);
export const bloomMix = createCanvas();
export const bloomMixCtx = bloomMix.getContext('2d')!;
export const glitchRed = createCanvas();
export const glitchRedCtx = glitchRed.getContext('2d')!;
export const glitchCyan = createCanvas();
export const glitchCyanCtx = glitchCyan.getContext('2d')!;
export const pixelSmall = createCanvas();
export const pixelSmallCtx = pixelSmall.getContext('2d')!;
export const pixelTile = createCanvas();
export const pixelTileCtx = pixelTile.getContext('2d')!;
const snapshot = createCanvas(1);
const snapshotCtx = snapshot.getContext('2d')!;
const fullSize = [output, scene, kaleidoBuffer, transitionFrame];
let sized = false;

export function gradientCache(create: () => CanvasGradient) {
  let gradient: CanvasGradient | undefined;
  let from = '';
  let to = '';
  return (fromColor: string, toColor: string) => {
    if (!gradient || fromColor !== from || toColor !== to) {
      gradient = create();
      gradient.addColorStop(0, fromColor);
      gradient.addColorStop(1, toColor);
      from = fromColor;
      to = toColor;
    }
    return gradient;
  };
}

function takeSnapshot() {
  snapshot.width = view.width;
  snapshot.height = view.height;
  snapshotCtx.drawImage(output, 0, 0);
}

export function resize() {
  const pixels = innerWidth * innerHeight;
  const ratio = Math.min(Math.min(devicePixelRatio || 1, 1.5), Math.sqrt(2.2e6 / pixels)) * view.quality;
  const width = Math.max(2, Math.round(innerWidth * ratio));
  const height = Math.max(2, Math.round(innerHeight * ratio));
  view.pixelRatio = ratio;
  if (sized && width === view.width && height === view.height) return;
  const keep = view.width > 2;
  if (keep) takeSnapshot();
  sized = true;
  view.width = width;
  view.height = height;
  view.diagonal = Math.hypot(width, height);
  view.minSide = Math.min(width, height);

  for (const canvas of fullSize) {
    canvas.width = width;
    canvas.height = height;
  }
  let levelWidth = width;
  let levelHeight = height;
  for (const canvas of bloomLevels) {
    levelWidth = Math.max(1, levelWidth >> 1);
    levelHeight = Math.max(1, levelHeight >> 1);
    canvas.width = levelWidth;
    canvas.height = levelHeight;
  }
  glitchRed.width = glitchCyan.width = bloomMix.width = bloomLevels[1].width;
  glitchRed.height = glitchCyan.height = bloomMix.height = bloomLevels[1].height;

  kaleidoCtx.globalCompositeOperation = transitionCtx.globalCompositeOperation = 'copy';
  bloomContexts.forEach((ctx) => {
    ctx.globalCompositeOperation = 'copy';
  });
  sceneCtx.fillStyle = outputCtx.fillStyle = BACKGROUND;
  sceneCtx.fillRect(0, 0, width, height);
  outputCtx.fillRect(0, 0, width, height);
  if (!keep) return;
  sceneCtx.drawImage(snapshot, 0, 0, width, height);
  snapshot.width = snapshot.height = 1;
}

let averageFrameMs = 16;
let slowMs = 0;
let fastMs = 0;

export function adaptQuality(frameMs: number) {
  averageFrameMs += (frameMs - averageFrameMs) * 0.05;
  if (averageFrameMs > 21) {
    slowMs += frameMs;
    fastMs = 0;
  } else if (averageFrameMs < 17.6) {
    fastMs += frameMs;
    slowMs = Math.max(0, slowMs - frameMs);
  } else {
    fastMs = 0;
    slowMs = Math.max(0, slowMs - frameMs);
  }
  if (slowMs > 1500 && view.quality > 0.45) {
    view.quality = Math.max(0.45, view.quality * 0.82);
    slowMs = 0;
    averageFrameMs = 16;
    resize();
  } else if (fastMs > 12000 && view.quality < 1) {
    view.quality = Math.min(1, view.quality * 1.1);
    fastMs = 0;
    resize();
  }
}

export function fillWith(o: CanvasRenderingContext2D, operation: GlobalCompositeOperation, style: string) {
  o.globalCompositeOperation = operation;
  o.fillStyle = style;
  o.fillRect(0, 0, view.width, view.height);
}
