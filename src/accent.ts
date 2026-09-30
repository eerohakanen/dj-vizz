import { markDataUrl } from './brand';
import { blendedHsl } from './color';
import { quantize, wrap } from './math';
import { motionScale } from './motion';

const MIN_LUMINANCE = 0.2;
const HUE_STEP = 0.5;
const LIGHTNESS_STEP = 0.1;
const BASE_LIGHTNESS = 50;
const CYCLE_SECONDS = 9;
const FAVICON_HUE_STEP = 30;

let applied = '';
let appliedIcon = '';
let phase = 0;

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
  let below = hslLuminance(hue, saturation, BASE_LIGHTNESS);
  if (below >= MIN_LUMINANCE) return BASE_LIGHTNESS;
  for (let lightness = BASE_LIGHTNESS + 1; lightness <= 100; lightness++) {
    const luminance = hslLuminance(hue, saturation, lightness);
    if (luminance >= MIN_LUMINANCE) return lightness - (luminance - MIN_LUMINANCE) / (luminance - below);
    below = luminance;
  }
  return 100;
}

export function accentStyle(hue: number, saturation: number) {
  const snappedHue = wrap(quantize(hue, HUE_STEP), 360);
  const roundedSaturation = Math.round(saturation);
  const lightness = Math.ceil(legibleLightness(snappedHue, roundedSaturation) / LIGHTNESS_STEP) * LIGHTNESS_STEP;
  return `hsl(${snappedHue} ${roundedSaturation}% ${lightness.toFixed(1)}%)`;
}

export const advanceAccentPhase = (current: number, delta: number, scale: number) =>
  wrap(current + (delta / CYCLE_SECONDS) * scale, 1);

const accentPosition = () => phase * 2;

export const liveAccent = () => applied;

function syncFavicon(hue: number, saturation: number) {
  const style = accentStyle(quantize(hue, FAVICON_HUE_STEP), saturation);
  if (style === appliedIcon) return;
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  appliedIcon = style;
  link.href = markDataUrl(style);
}

export function syncAccent(delta: number) {
  phase = advanceAccentPhase(phase, delta, motionScale());
  const [hue, saturation] = blendedHsl(accentPosition());
  const style = accentStyle(hue, saturation);
  if (style === applied) return;
  applied = style;
  document.documentElement.style.setProperty('--live', style);
  syncFavicon(hue, saturation);
}
