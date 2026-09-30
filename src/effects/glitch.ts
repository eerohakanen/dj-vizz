import { bloomLevels, glitchCyan, glitchCyanCtx, glitchRed, glitchRedCtx, output } from '../canvas';
import { fx, settings, view } from '../state';

const CHANNELS: [CanvasRenderingContext2D, string][] = [
  [glitchRedCtx, '#ff2050'],
  [glitchCyanCtx, '#20e0ff'],
];

function splitChannels(o: CanvasRenderingContext2D, amount: number) {
  const { width, height, pixelRatio } = view;
  const offset = amount * 20 * pixelRatio * settings.reactivity;
  for (const [channelCtx, tint] of CHANNELS) {
    channelCtx.globalCompositeOperation = 'copy';
    channelCtx.drawImage(bloomLevels[1], 0, 0);
    channelCtx.globalCompositeOperation = 'multiply';
    channelCtx.fillStyle = tint;
    channelCtx.fillRect(0, 0, channelCtx.canvas.width, channelCtx.canvas.height);
  }
  o.globalCompositeOperation = 'screen';
  o.globalAlpha = Math.min(1, 0.7 * amount);
  o.drawImage(glitchRed, offset, 0, width, height);
  o.drawImage(glitchCyan, -offset, 0, width, height);
  o.globalCompositeOperation = 'source-over';
  o.globalAlpha = 1;
}

function tearSlices(o: CanvasRenderingContext2D, amount: number) {
  const { width, height } = view;
  const slices = (2 + amount * 10) | 0;
  for (let k = 0; k < slices; k++) {
    const y = (Math.random() * height) | 0;
    const sliceHeight = Math.min(height - y, ((Math.random() * 0.06 + 0.01) * height) | 0);
    if (sliceHeight < 1) continue;
    const shift = (Math.random() - 0.5) * width * 0.15 * amount;
    o.drawImage(output, 0, y, width, sliceHeight, shift, y, width, sliceHeight);
  }
}

export function applyGlitch(o: CanvasRenderingContext2D) {
  const amount = fx.glitchAmount;
  if (amount < 0.05) return;
  splitChannels(o, amount);
  tearSlices(o, amount);
}
