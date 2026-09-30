import { colorHsl } from './color';
import { quantize, wrap } from './math';

const MIN_LUMINANCE = 0.2;
const HUE_STEP = 3;
const BASE_LIGHTNESS = 50;

let applied = '';

const linear = (channel: number) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);

export function hslLuminance(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = s * Math.min(l, 1 - l);
  const channel = (offset: number) => {
    const k = (offset + hue / 30) % 12;
    return l - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return 0.2126 * linear(channel(0)) + 0.7152 * linear(channel(8)) + 0.0722 * linear(channel(4));
}

export function legibleLightness(hue: number, saturation: number) {
  for (let lightness = BASE_LIGHTNESS; lightness < 100; lightness++) {
    if (hslLuminance(hue, saturation, lightness) >= MIN_LUMINANCE) return lightness;
  }
  return 100;
}

export function accentStyle(hue: number, saturation: number) {
  const snappedHue = wrap(quantize(hue, HUE_STEP), 360);
  const roundedSaturation = Math.round(saturation);
  return `hsl(${snappedHue} ${roundedSaturation}% ${legibleLightness(snappedHue, roundedSaturation)}%)`;
}

export function syncAccent() {
  const [hue, saturation] = colorHsl(0);
  const style = accentStyle(hue, saturation);
  if (style === applied) return;
  applied = style;
  document.documentElement.style.setProperty('--live', style);
}
