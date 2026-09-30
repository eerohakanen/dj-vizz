import { BACKGROUND, kaleidoBuffer, kaleidoCtx, output } from '../canvas';
import { fx, settings, view } from '../state';

const MIRROR = 1;
const QUAD = 2;
const KALEIDO_SLICES = 6;
const SLICE_HALF_ANGLE = Math.PI / 6 + 0.01;

function mirrorHalves(o: CanvasRenderingContext2D) {
  const { width, height } = view;
  o.save();
  o.translate(width, 0);
  o.scale(-1, 1);
  o.drawImage(output, 0, 0, width / 2, height, 0, 0, width / 2, height);
  o.restore();
  if (settings.mirror !== QUAD) return;
  o.save();
  o.translate(0, height);
  o.scale(1, -1);
  o.drawImage(output, 0, 0, width, height / 2, 0, 0, width, height / 2);
  o.restore();
}

function kaleidoscope(o: CanvasRenderingContext2D) {
  const { width, height, diagonal } = view;
  kaleidoCtx.drawImage(output, 0, 0);
  o.fillStyle = BACKGROUND;
  o.fillRect(0, 0, width, height);
  for (let i = 0; i < KALEIDO_SLICES; i++) {
    o.save();
    o.translate(width / 2, height / 2);
    o.rotate((i * Math.PI) / 3 + fx.spin * 0.3);
    if (i % 2) o.scale(1, -1);
    o.beginPath();
    o.moveTo(0, 0);
    o.arc(0, 0, diagonal, -SLICE_HALF_ANGLE, SLICE_HALF_ANGLE);
    o.closePath();
    o.clip();
    o.drawImage(kaleidoBuffer, -width / 2, -height / 2);
    o.restore();
  }
}

export function applyMirror(o: CanvasRenderingContext2D) {
  if (settings.mirror < MIRROR) return;
  if (settings.mirror <= QUAD) mirrorHalves(o);
  else kaleidoscope(o);
}
