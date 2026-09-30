import { BACKGROUND, output, pixelSmall, pixelSmallCtx, pixelTile, pixelTileCtx } from '../canvas';
import { pixelateAvailable } from '../mode';
import { pixelIndex } from './options';
import { settings, view } from '../state';

const SQUARE = pixelIndex('Square');
const ROUND = pixelIndex('Round');
const MIN_CELL = 2;

let maskKey = '';
let mask: CanvasPattern | null = null;

function cutShape(cell: number, inner: number) {
  const center = cell / 2;
  const half = inner / 2;
  pixelTileCtx.beginPath();
  if (settings.pixelate === ROUND) {
    pixelTileCtx.arc(center, center, half, 0, Math.PI * 2);
  } else if (settings.pixelate === SQUARE) {
    pixelTileCtx.rect(center - half, center - half, inner, inner);
  } else {
    pixelTileCtx.moveTo(center, center - half);
    pixelTileCtx.lineTo(center + half, center);
    pixelTileCtx.lineTo(center, center + half);
    pixelTileCtx.lineTo(center - half, center);
    pixelTileCtx.closePath();
  }
  pixelTileCtx.fill();
}

function cellMask(o: CanvasRenderingContext2D, cell: number) {
  const key = `${settings.pixelate}:${cell}:${settings.pixelGap}`;
  if (key === maskKey) return mask;
  maskKey = key;
  pixelTile.width = pixelTile.height = cell;
  pixelTileCtx.fillStyle = BACKGROUND;
  pixelTileCtx.fillRect(0, 0, cell, cell);
  pixelTileCtx.globalCompositeOperation = 'destination-out';
  cutShape(cell, cell * (1 - settings.pixelGap));
  pixelTileCtx.globalCompositeOperation = 'source-over';
  mask = o.createPattern(pixelTile, 'repeat');
  return mask;
}

function downsample(columns: number, rows: number, offsetX: number, offsetY: number, cell: number) {
  const { width, height } = view;
  if (pixelSmall.width !== columns || pixelSmall.height !== rows) {
    pixelSmall.width = columns;
    pixelSmall.height = rows;
  }
  pixelSmallCtx.imageSmoothingQuality = 'high';
  pixelSmallCtx.fillStyle = BACKGROUND;
  pixelSmallCtx.fillRect(0, 0, columns, rows);
  pixelSmallCtx.drawImage(output, -offsetX / cell, -offsetY / cell, width / cell, height / cell);
}

export function applyPixelate(o: CanvasRenderingContext2D) {
  if (settings.pixelate < SQUARE || !pixelateAvailable()) return;
  const { width, height } = view;
  const cell = Math.max(MIN_CELL, Math.round(settings.pixelSize * view.pixelRatio));
  const columns = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const offsetX = (width - columns * cell) / 2;
  const offsetY = (height - rows * cell) / 2;
  downsample(columns, rows, offsetX, offsetY, cell);
  o.imageSmoothingEnabled = false;
  o.drawImage(pixelSmall, offsetX, offsetY, columns * cell, rows * cell);
  o.imageSmoothingEnabled = true;
  if (settings.pixelate === SQUARE && settings.pixelGap === 0) return;
  const pattern = cellMask(o, cell);
  if (!pattern) return;
  o.save();
  o.translate(offsetX, offsetY);
  o.fillStyle = pattern;
  o.fillRect(-offsetX, -offsetY, width, height);
  o.restore();
}
