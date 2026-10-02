export const TAU = Math.PI * 2;

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const clamp01 = (value: number) => clamp(value, 0, 1);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const approach = (value: number, target: number, rate: number, delta: number) => value + (target - value) * Math.min(1, delta * rate);

export const decay = (factor: number, delta: number) => Math.pow(factor, delta);

export const REFERENCE_FPS = 60;

export const frameScale = (delta: number) => delta * REFERENCE_FPS;

export const frameAlpha = (alpha: number, delta: number) => 1 - decay(1 - alpha, frameScale(delta));

export const follow = (value: number, target: number, attack: number, release: number, delta: number) =>
  value + (target - value) * (1 - Math.exp(-delta / (target > value ? attack : release)));

export const rise = (value: number, target: number, attack: number, delta: number) =>
  target > value ? follow(value, target, attack, attack, delta) : target;

export const wobble = (time: number, axis: number) =>
  (Math.sin(time * 29 + axis * 2.1) * 0.5 + Math.sin(time * 43 + axis * 4.7) * 0.3 + Math.sin(time * 61 + axis * 1.3) * 0.2) * 0.5;

export const updatePeak = (peak: number, level: number, fall: number, delta: number) => Math.max(level, peak - fall * delta);

export const stretch = (level: number, floor: number, peak: number, minRange: number) =>
  clamp01((level - floor) / Math.max(minRange, peak - floor));

export function keepNewest<T>(items: T[], max: number) {
  if (items.length > max) items.splice(0, items.length - max);
}

export const smoothstep = (t: number) => t * t * (3 - 2 * t);

export const wrap = (value: number, length: number) => ((value % length) + length) % length;

export const quantize = (value: number, step: number) => Math.round(value / step) * step;

export const hueDelta = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

export const randomRange = (min: number, max: number) => min + Math.random() * (max - min);

export const signedRandom = (scale: number) => (Math.random() - 0.5) * scale;
