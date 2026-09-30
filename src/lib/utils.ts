import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isNumber = (value: unknown): value is number => typeof value === 'number' && isFinite(value);

export const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';
