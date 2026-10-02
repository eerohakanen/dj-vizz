import { bloomContexts, bloomLevels, bloomMix, bloomMixCtx, output } from '../canvas';
import { fx, signal, view } from '../state';

const WIDE_WEIGHT = 0.6;
const NEAR_WEIGHT = 0.3;

function mixLevels() {
  const { width, height } = bloomMix;
  bloomMixCtx.globalCompositeOperation = 'copy';
  bloomMixCtx.globalAlpha = NEAR_WEIGHT;
  bloomMixCtx.drawImage(bloomLevels[1], 0, 0);
  bloomMixCtx.globalCompositeOperation = 'lighter';
  bloomMixCtx.globalAlpha = WIDE_WEIGHT;
  bloomMixCtx.drawImage(bloomLevels[3], 0, 0, width, height);
}

export function applyBloom(o: CanvasRenderingContext2D) {
  const { width, height } = view;
  bloomContexts[0].drawImage(output, 0, 0, bloomLevels[0].width, bloomLevels[0].height);
  for (let i = 1; i < bloomLevels.length; i++) {
    bloomContexts[i].drawImage(bloomLevels[i - 1], 0, 0, bloomLevels[i].width, bloomLevels[i].height);
  }
  mixLevels();
  const alpha = Math.min(0.4, (0.14 + fx.beat * 0.15 + fx.drop * 0.2) * Math.max(signal.gate, 0.15));
  o.globalCompositeOperation = 'lighter';
  o.globalAlpha = alpha / WIDE_WEIGHT;
  o.drawImage(bloomMix, 0, 0, width, height);
  o.globalAlpha = 1;
}
