import { createCanvas } from './canvas';
import { clamp } from './math';
import { view } from './state';

export const DENSITY_RAMP = ' .:-=+*#%@';
export const RAIN_GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎ0123456789:=*+<>';

const GLYPH_FONT = 'ui-monospace, Menlo, Consolas, monospace';
const MIN_GLYPH_LEVEL = 0.03;

export const glyphIndex = (level: number, count: number) => clamp(Math.floor(level * count), 0, count - 1);

export const brightness = (red: number, green: number, blue: number) => Math.max(red, green, blue) / 255;

export function createGlyphSheet(glyphs: string) {
  const characters = [...glyphs];
  const base = createCanvas();
  const baseCtx = base.getContext('2d')!;
  const tinted = createCanvas();
  const tintedCtx = tinted.getContext('2d')!;
  let baseCell = 0;
  let tint = '';

  function drawBase(cell: number) {
    base.width = cell * characters.length;
    base.height = cell;
    baseCtx.font = `bold ${Math.round(cell * 0.95)}px ${GLYPH_FONT}`;
    baseCtx.textAlign = 'center';
    baseCtx.textBaseline = 'middle';
    baseCtx.fillStyle = '#fff';
    characters.forEach((character, index) => baseCtx.fillText(character, (index + 0.5) * cell, cell * 0.54));
    tinted.width = base.width;
    tinted.height = base.height;
    baseCell = cell;
    tint = '';
  }

  return {
    count: characters.length,
    paint(cell: number, style: string) {
      if (cell !== baseCell) drawBase(cell);
      if (style !== tint) {
        tintedCtx.globalCompositeOperation = 'copy';
        tintedCtx.drawImage(base, 0, 0);
        tintedCtx.globalCompositeOperation = 'source-in';
        tintedCtx.fillStyle = style;
        tintedCtx.fillRect(0, 0, tinted.width, tinted.height);
        tintedCtx.globalCompositeOperation = 'source-over';
        tint = style;
      }
      return tinted;
    },
  };
}

export type GlyphSheet = ReturnType<typeof createGlyphSheet>;

export function drawGlyphField(
  target: CanvasRenderingContext2D,
  field: Float32Array,
  columns: number,
  rows: number,
  cell: number,
  sheets: HTMLCanvasElement[],
  count: number,
) {
  const offsetX = (target.canvas.width - columns * cell) / 2;
  const offsetY = (target.canvas.height - rows * cell) / 2;
  const tones = sheets.length;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const level = field[row * columns + column];
      if (level <= MIN_GLYPH_LEVEL) continue;
      const glyph = glyphIndex(level, count - 1) + 1;
      const sheet = sheets[Math.min(tones - 1, (level * tones) | 0)];
      target.drawImage(sheet, glyph * cell, 0, cell, cell, offsetX + column * cell, offsetY + row * cell, cell, cell);
    }
  }
}

export function glyphGrid(cellSize: number) {
  const cell = Math.max(6, Math.round(cellSize * view.pixelRatio));
  return { cell, columns: Math.ceil(view.width / cell), rows: Math.ceil(view.height / cell) };
}
