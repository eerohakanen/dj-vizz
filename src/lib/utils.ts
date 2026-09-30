import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({ extend: { theme: { shadow: ['hard'] } } });

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const pluralize = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export const isNumber = (value: unknown): value is number => typeof value === 'number' && isFinite(value);

export const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';
