import { approach } from '../math';
import { clock } from '../state';

export const STYLE_RATE = 2;
export const STRONG_PHRASE = 0.55;

export function nextVariant(current: number, count: number, strength: number) {
  if (count < 2) return current;
  const reach = strength >= STRONG_PHRASE ? count - 1 : 1;
  return (current + 1 + Math.floor(Math.random() * reach)) % count;
}

export function glideStyle<K extends string>(style: Record<NoInfer<K>, number>, target: Readonly<Record<K, number>>) {
  for (const key of Object.keys(target) as K[]) style[key] = approach(style[key], target[key], STYLE_RATE, clock.delta);
}
