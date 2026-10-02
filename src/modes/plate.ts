import { createCanvas, gradientCache, sceneCtx as ctx } from '../canvas';
import { view } from '../state';

export function createPlate(pixel: number) {
  const canvas = createCanvas();
  const plateCtx = canvas.getContext('2d')!;
  const tint = gradientCache(() => plateCtx.createLinearGradient(0, 0, 1, 1));
  let pixels: ImageData | null = null;
  let cellSize = 1;

  return {
    columns: 0,
    rows: 0,
    alpha: new Uint8ClampedArray(0),
    fit() {
      cellSize = Math.max(2, Math.round(pixel * view.pixelRatio));
      const columns = Math.ceil(view.width / cellSize);
      const rows = Math.ceil(view.height / cellSize);
      if (pixels?.width !== columns || pixels.height !== rows) {
        canvas.width = columns;
        canvas.height = rows;
        pixels = plateCtx.createImageData(columns, rows);
        this.columns = columns;
        this.rows = rows;
        this.alpha = pixels.data;
      }
      return this;
    },
    set(index: number, level: number) {
      this.alpha[index * 4 + 3] = level * 255;
    },
    present(fromColor: string, toColor: string) {
      plateCtx.putImageData(pixels!, 0, 0);
      plateCtx.globalCompositeOperation = 'source-in';
      plateCtx.setTransform(this.columns, 0, 0, this.rows, 0, 0);
      plateCtx.fillStyle = tint(fromColor, toColor);
      plateCtx.fillRect(0, 0, 1, 1);
      plateCtx.setTransform(1, 0, 0, 1, 0, 0);
      plateCtx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(canvas, 0, 0, this.columns * cellSize, this.rows * cellSize);
    },
  };
}
