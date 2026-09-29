import { bloomContexts, bloomLevels, output } from '../canvas.js';
import { fx, signal, view } from '../state.js';

export function applyBloom(o) {
  const { width, height } = view;
  bloomContexts[0].drawImage(output, 0, 0, bloomLevels[0].width, bloomLevels[0].height);
  for (let i = 1; i < bloomLevels.length; i++) {
    bloomContexts[i].drawImage(bloomLevels[i - 1], 0, 0, bloomLevels[i].width, bloomLevels[i].height);
  }
  const alpha = Math.min(0.6, (0.14 + fx.beat * 0.25 + fx.drop * 0.35) * Math.max(signal.gate, 0.15));
  o.globalCompositeOperation = 'lighter';
  o.globalAlpha = alpha;
  o.drawImage(bloomLevels[3], 0, 0, width, height);
  o.globalAlpha = alpha * 0.5;
  o.drawImage(bloomLevels[1], 0, 0, width, height);
  o.globalAlpha = 1;
}
