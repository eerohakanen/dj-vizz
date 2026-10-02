import { createCanvas, sceneCtx as ctx } from '../canvas';

const tint = createCanvas();
const tintCtx = tint.getContext('2d')!;

export function tinted(frame: ImageBitmap, style: string, amount: number, operation: GlobalCompositeOperation = 'source-atop') {
  if (tint.width !== frame.width || tint.height !== frame.height) {
    tint.width = frame.width;
    tint.height = frame.height;
  }
  tintCtx.globalCompositeOperation = 'copy';
  tintCtx.drawImage(frame, 0, 0);
  tintCtx.globalCompositeOperation = operation;
  tintCtx.globalAlpha = amount;
  tintCtx.fillStyle = style;
  tintCtx.fillRect(0, 0, tint.width, tint.height);
  tintCtx.globalAlpha = 1;
  if (operation !== 'source-atop') {
    tintCtx.globalCompositeOperation = 'destination-in';
    tintCtx.drawImage(frame, 0, 0);
  }
  return tint;
}

interface SpriteOptions {
  mirrored?: boolean;
  squash?: number;
  smooth?: boolean;
}

export function drawSprite(image: HTMLCanvasElement | ImageBitmap, x: number, baseY: number, height: number, { mirrored = false, squash = 0, smooth = true }: SpriteOptions = {}) {
  const scale = height / image.height;
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(scale * (1 + squash) * (mirrored ? -1 : 1), scale * (1 - squash));
  ctx.imageSmoothingEnabled = smooth;
  ctx.drawImage(image, -image.width / 2, -image.height);
  ctx.restore();
}
