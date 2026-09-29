import { $ } from './dom.js';
import { view } from './state.js';

export const BACKGROUND = '#05050a';

export function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  if (width) {
    canvas.width = width;
    canvas.height = height || width;
  }
  return canvas;
}

export const output = $('cv');
export const outputCtx = output.getContext('2d', { alpha: false });
export const scene = createCanvas();
export const sceneCtx = scene.getContext('2d', { alpha: false });
export const kaleidoBuffer = createCanvas();
export const kaleidoCtx = kaleidoBuffer.getContext('2d');
export const transitionFrame = createCanvas();
export const transitionCtx = transitionFrame.getContext('2d');
export const bloomLevels = [createCanvas(), createCanvas(), createCanvas(), createCanvas()];
export const bloomContexts = bloomLevels.map((canvas) => canvas.getContext('2d'));
export const glitchRed = createCanvas();
export const glitchRedCtx = glitchRed.getContext('2d');
export const glitchCyan = createCanvas();
export const glitchCyanCtx = glitchCyan.getContext('2d');

export function resize() {
  let previous = null;
  if (view.width > 2) {
    previous = createCanvas(view.width, view.height);
    previous.getContext('2d').drawImage(output, 0, 0);
  }
  const pixels = innerWidth * innerHeight;
  const ratio = Math.min(Math.min(devicePixelRatio || 1, 1.5), Math.sqrt(2.2e6 / pixels)) * view.quality;
  view.pixelRatio = ratio;
  view.width = Math.max(2, Math.round(innerWidth * ratio));
  view.height = Math.max(2, Math.round(innerHeight * ratio));
  view.diagonal = Math.hypot(view.width, view.height);
  view.minSide = Math.min(view.width, view.height);
  const { width, height } = view;

  for (const canvas of [output, scene, kaleidoBuffer, transitionFrame]) {
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
  glitchRed.width = glitchCyan.width = bloomLevels[1].width;
  glitchRed.height = glitchCyan.height = bloomLevels[1].height;

  kaleidoCtx.globalCompositeOperation = transitionCtx.globalCompositeOperation = 'copy';
  bloomContexts.forEach((ctx) => {
    ctx.globalCompositeOperation = 'copy';
  });
  sceneCtx.fillStyle = outputCtx.fillStyle = BACKGROUND;
  sceneCtx.fillRect(0, 0, width, height);
  outputCtx.fillRect(0, 0, width, height);
  if (previous) sceneCtx.drawImage(previous, 0, 0, width, height);
}

let averageFrameMs = 16;
let slowMs = 0;
let fastMs = 0;

export function adaptQuality(frameMs) {
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
