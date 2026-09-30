import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { clock, fx, signal, view } from '../state';

const BEAMS = 8;

export function drawLasers() {
  if (fx.laserMix < 0.02 || signal.gate < 0.05) return;
  const { width, height, diagonal, pixelRatio } = view;
  const alpha = Math.min(1, 0.25 + signal.punchHigh * 0.6 + fx.beat * 0.3) * signal.gate * fx.laserMix;
  ctx.lineCap = 'round';
  for (let i = 0; i < BEAMS; i++) {
    const fromLeft = i < BEAMS / 2;
    const originX = fromLeft ? 0 : width;
    const baseAngle = fromLeft ? -Math.PI / 4 : (-3 * Math.PI) / 4;
    const angle = baseAngle + Math.sin(clock.time * (0.6 + i * 0.17) + fx.spin * 2 + i) * (0.5 + fx.drop * 0.6);
    ctx.strokeStyle = color(i * 0.35, alpha);
    ctx.lineWidth = (1 + signal.punchHigh * 5 + fx.beat * 4) * pixelRatio;
    ctx.beginPath();
    ctx.moveTo(originX, height);
    ctx.lineTo(originX + Math.cos(angle) * diagonal, height + Math.sin(angle) * diagonal);
    ctx.stroke();
  }
}
