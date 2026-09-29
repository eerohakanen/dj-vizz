import { $, showMessage } from './dom.js';
import { PALETTES } from './palettes.js';
import { fx, settings } from './state.js';

const LUT_SIZE = 64;
const lut = new Float32Array(LUT_SIZE * 3);
const currentHsl = new Float32Array(3);
const previousHsl = new Float32Array(3);
let previousPalette = 1;
let fade = 1;

function samplePalette(index, position, out) {
  const palette = PALETTES[index];
  if (palette.rainbow) {
    out[0] = position * 360;
    out[1] = 100;
    out[2] = 58;
    return;
  }
  const { stops } = palette;
  const scaled = position * stops.length;
  const from = stops[Math.floor(scaled) % stops.length];
  const to = stops[(Math.floor(scaled) + 1) % stops.length];
  const blend = scaled - Math.floor(scaled);
  let hueStep = to[0] - from[0];
  if (hueStep > 180) hueStep -= 360;
  if (hueStep < -180) hueStep += 360;
  out[0] = from[0] + hueStep * blend;
  out[1] = from[1] + (to[1] - from[1]) * blend;
  out[2] = from[2] + (to[2] - from[2]) * blend;
}

export function buildLut() {
  for (let i = 0; i < LUT_SIZE; i++) {
    const position = i / LUT_SIZE;
    samplePalette(settings.palette, position, currentHsl);
    if (fade < 1) {
      samplePalette(previousPalette, position, previousHsl);
      const eased = fade * fade * (3 - 2 * fade);
      const hueStep = (((currentHsl[0] - previousHsl[0]) % 360) + 540) % 360 - 180;
      currentHsl[0] = previousHsl[0] + hueStep * eased;
      currentHsl[1] = previousHsl[1] + (currentHsl[1] - previousHsl[1]) * eased;
      currentHsl[2] = previousHsl[2] + (currentHsl[2] - previousHsl[2]) * eased;
    }
    lut[i * 3] = ((currentHsl[0] % 360) + 360) % 360;
    lut[i * 3 + 1] = currentHsl[1];
    lut[i * 3 + 2] = currentHsl[2];
  }
}

export function advancePaletteFade(delta) {
  fade = Math.min(1, fade + delta / 1.5);
}

export function color(position, alpha = 1, lightness) {
  let x = (position * 0.5 + fx.hue / 360) % 1;
  if (x < 0) x += 1;
  const k = ((x * LUT_SIZE) | 0) * 3;
  let light = lut[k + 2] + (lightness == null ? 0 : lightness - 58) + fx.beat * 8;
  light = light < 5 ? 5 : light > 95 ? 95 : light;
  const clampedAlpha = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  return `hsla(${lut[k] | 0},${lut[k + 1] | 0}%,${light | 0}%,${clampedAlpha.toFixed(3)})`;
}

export function renderPaletteButton() {
  $('bCol').textContent = `Color: ${PALETTES[settings.palette].name} (C)`;
}

export function setPalette(index, quiet) {
  previousPalette = settings.palette;
  fade = 0;
  settings.palette = (index + PALETTES.length) % PALETTES.length;
  renderPaletteButton();
  if (!quiet) showMessage(`Palette: ${PALETTES[settings.palette].name}`);
}
