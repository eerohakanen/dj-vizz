import { showMessage } from './dom';
import { clamp, clamp01, hueDelta, lerp, quantize, smoothstep, wrap } from './math';
import { PALETTES, type Palette } from './palettes';
import { fx, settings, signal } from './state';
import { notify } from './store';

export const KEY_CONFIDENCE_FLOOR = 0.5;
const KEY_CONFIDENCE_FULL = 0.8;
const KEY_TINT_RANGE = 40;
const KEY_PALETTE_CHOICES = 3;
const MODE_HUE_SHIFT = 8;
const MODE_LIGHTNESS_SHIFT = 3;
const WARM_HUE = 30;
const COOL_HUE = 220;
const LUT_SIZE = 64;
const KEY_HUE_STEP = 0.5;
const KEY_STRENGTH_STEP = 1 / 128;
const STYLE_CACHE_LIMIT = 4096;
const lut = new Float32Array(LUT_SIZE * 3);
const styleCache = new Map<number, string>();
const shade = new Int16Array(3);
const blended = new Float32Array(3);
const built = { palette: -1, previousPalette: -1, fade: -1, hue: NaN, keyStrength: NaN, minor: false };
const currentHsl = new Float32Array(3);
const previousHsl = new Float32Array(3);
let previousPalette = 1;
let fade = 1;

const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function keyHue(key: number) {
  const majorTonic = key >= 12 ? (key - 12 + 3) % 12 : key;
  return ((majorTonic * 7) % 12) * 30;
}

export const keyTintStrength = (confidence: number) =>
  smoothstep(clamp01((confidence - KEY_CONFIDENCE_FLOOR) / (KEY_CONFIDENCE_FULL - KEY_CONFIDENCE_FLOOR)));

export const keyTintOffset = (baseHue: number | null, hue: number) =>
  baseHue === null ? 0 : KEY_TINT_RANGE * Math.sin(radians(hueDelta(baseHue, hue)));

export function paletteHue(palette: Palette) {
  if (palette.rainbow) return null;
  let x = 0;
  let y = 0;
  for (const [hue, saturation] of palette.stops) {
    x += saturation * Math.cos(radians(hue));
    y += saturation * Math.sin(radians(hue));
  }
  if (Math.hypot(x, y) < 1e-6) return null;
  return wrap((Math.atan2(y, x) * 180) / Math.PI, 360);
}

const PALETTE_HUES = PALETTES.map(paletteHue);

export function rankPalettesByHue(hue: number, exclude: number) {
  return PALETTE_HUES.flatMap((candidate, index) =>
    candidate === null || index === exclude ? [] : [{ index, distance: Math.abs(hueDelta(candidate, hue)) }],
  )
    .sort((a, b) => a.distance - b.distance)
    .map(({ index }) => index);
}

export function keyPalette(hue: number, current: number, random = Math.random) {
  const nearest = rankPalettesByHue(hue, current).slice(0, KEY_PALETTE_CHOICES);
  return nearest[Math.floor(random() * nearest.length)];
}

function samplePalette(index: number, position: number, out: Float32Array) {
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

function fillLut(hue: number, keyStrength: number, minor: boolean) {
  const currentOffset = keyTintOffset(PALETTE_HUES[settings.palette], hue) * keyStrength;
  const previousOffset = keyTintOffset(PALETTE_HUES[previousPalette], hue) * keyStrength;
  const modeHue = minor ? COOL_HUE : WARM_HUE;
  const modeHueShift = MODE_HUE_SHIFT * keyStrength;
  const modeLightness = (minor ? -MODE_LIGHTNESS_SHIFT : MODE_LIGHTNESS_SHIFT) * keyStrength;
  for (let i = 0; i < LUT_SIZE; i++) {
    const position = i / LUT_SIZE;
    samplePalette(settings.palette, position, currentHsl);
    currentHsl[0] += currentOffset;
    if (fade < 1) {
      samplePalette(previousPalette, position, previousHsl);
      previousHsl[0] += previousOffset;
      const eased = smoothstep(fade);
      const hueStep = hueDelta(previousHsl[0], currentHsl[0]);
      currentHsl[0] = previousHsl[0] + hueStep * eased;
      currentHsl[1] = lerp(previousHsl[1], currentHsl[1], eased);
      currentHsl[2] = lerp(previousHsl[2], currentHsl[2], eased);
    }
    const modeStep = modeHueShift * Math.sin(radians(hueDelta(currentHsl[0], modeHue)));
    lut[i * 3] = wrap(currentHsl[0] + modeStep, 360);
    lut[i * 3 + 1] = currentHsl[1];
    lut[i * 3 + 2] = clamp(currentHsl[2] + modeLightness, 0, 100);
  }
}

export function buildLut() {
  const keyStrength = quantize(signal.key < 0 ? 0 : keyTintStrength(signal.keyConfidence), KEY_STRENGTH_STEP);
  const hue = quantize(fx.keyHue, KEY_HUE_STEP);
  const minor = signal.key >= 12;
  if (
    built.palette === settings.palette &&
    built.previousPalette === previousPalette &&
    built.fade === fade &&
    built.hue === hue &&
    built.keyStrength === keyStrength &&
    built.minor === minor
  )
    return false;
  built.palette = settings.palette;
  built.previousPalette = previousPalette;
  built.fade = fade;
  built.hue = hue;
  built.keyStrength = keyStrength;
  built.minor = minor;
  fillLut(hue, keyStrength, minor);
  return true;
}

export function advancePaletteFade(delta: number) {
  fade = Math.min(1, fade + delta / 1.5);
}

const alphaSteps = (alpha: number) => (alpha < 0 ? 0 : alpha > 1 ? 1000 : Math.round(alpha * 1000));

export const styleKey = (hue: number, saturation: number, lightness: number, alpha: number) =>
  (hue * 10201 + saturation * 101 + lightness) * 1001 + alphaSteps(alpha);

function lutPosition(position: number) {
  const x = (position * 0.5 + fx.hue / 360) % 1;
  return (x < 0 ? x + 1 : x) * LUT_SIZE;
}

export function blendedHsl(position: number) {
  const scaled = lutPosition(position);
  const cell = scaled | 0;
  const from = (cell % LUT_SIZE) * 3;
  const to = ((cell + 1) % LUT_SIZE) * 3;
  const blend = scaled - cell;
  blended[0] = wrap(lut[from] + hueDelta(lut[from], lut[to]) * blend, 360);
  blended[1] = lerp(lut[from + 1], lut[to + 1], blend);
  blended[2] = lerp(lut[from + 2], lut[to + 2], blend);
  return blended;
}

export function colorHsl(position: number, lightness?: number) {
  const hsl = blendedHsl(position);
  const mood = (signal.brightness - 0.5) * 14;
  const light = hsl[2] + (lightness == null ? 0 : lightness - 58) + fx.beat * 8 + mood;
  shade[0] = hsl[0];
  shade[1] = hsl[1];
  shade[2] = light < 5 ? 5 : light > 95 ? 95 : light;
  return shade;
}

export function color(position: number, alpha = 1, lightness?: number) {
  colorHsl(position, lightness);
  const hue = shade[0];
  const saturation = shade[1];
  const light = shade[2];
  const key = styleKey(hue, saturation, light, alpha);
  let style = styleCache.get(key);
  if (style === undefined) {
    if (styleCache.size >= STYLE_CACHE_LIMIT) styleCache.clear();
    style = `hsla(${hue},${saturation}%,${light}%,${(alphaSteps(alpha) / 1000).toFixed(3)})`;
    styleCache.set(key, style);
  }
  return style;
}

export function setPalette(index: number, quiet?: boolean) {
  previousPalette = settings.palette;
  fade = 0;
  settings.palette = wrap(index, PALETTES.length);
  notify();
  if (!quiet) showMessage(`Palette: ${PALETTES[settings.palette].name}`);
}
