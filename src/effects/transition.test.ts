import { describe, expect, it, vi } from 'vitest';

vi.mock('../canvas', () => ({ output: {}, transitionCtx: { drawImage: vi.fn() }, transitionFrame: {} }));

import { clock } from '../state';
import {
  DEFAULT_TRANSITION,
  drawTransition,
  findTransition,
  startTransition,
  TRANSITIONS,
  transitionDuration,
  transitionStyle,
} from './transition';

describe('transitionDuration', () => {
  it('keeps the default when tempo is not locked', () => {
    expect(transitionDuration(0)).toBe(1.1);
  });

  it('lasts one bar when locked', () => {
    expect(transitionDuration(120)).toBeCloseTo(2);
  });

  it('clamps very slow and very fast tempos', () => {
    expect(transitionDuration(60)).toBe(2.4);
    expect(transitionDuration(300)).toBe(0.8);
    expect(transitionDuration(500)).toBe(0.6);
  });
});

describe('transitionStyle', () => {
  it('picks one of the four random styles', () => {
    expect(transitionStyle(false, 0)).toBe(0);
    expect(transitionStyle(false, 0.99)).toBe(3);
    expect(transitionStyle(false, 1)).toBe(3);
  });

  it('only crossfades when motion is reduced', () => {
    expect(transitionStyle(true, 0)).toBe(4);
    expect(transitionStyle(true, 0.99)).toBe(4);
  });
});

describe('named transitions', () => {
  it('maps each motion kind to its style regardless of the random roll', () => {
    expect(transitionStyle(false, 0.99, 'zoom')).toBe(0);
    expect(transitionStyle(false, 0, 'spin')).toBe(1);
    expect(transitionStyle(false, 0, 'iris')).toBe(2);
    expect(transitionStyle(false, 0, 'strips')).toBe(3);
    expect(transitionStyle(false, 0, 'fade')).toBe(4);
  });

  it('crossfades any motion kind when motion is reduced', () => {
    expect(transitionStyle(true, 0, 'zoom')).toBe(4);
    expect(transitionStyle(true, 0, 'strips')).toBe(4);
  });

  it('stays a cut with or without reduced motion', () => {
    expect(transitionStyle(false, 0.5, 'cut')).toBe(-1);
    expect(transitionStyle(true, 0.5, 'cut')).toBe(-1);
  });
});

describe('findTransition', () => {
  it('finds known kinds and rejects unknown values', () => {
    expect(findTransition('iris')?.label).toBe('Iris');
    expect(findTransition('wipe')).toBeUndefined();
    expect(findTransition(3)).toBeUndefined();
  });

  it('defaults to a listed kind', () => {
    expect(TRANSITIONS.map(({ value }) => value)).toContain(DEFAULT_TRANSITION);
  });
});

describe('startTransition', () => {
  const drawsOverlay = () => {
    const context = { save: vi.fn(), restore: vi.fn(), drawImage: vi.fn(), globalAlpha: 1 };
    drawTransition(context as unknown as CanvasRenderingContext2D);
    return context.save.mock.calls.length > 0;
  };

  it('clears a running transition on a hard cut', () => {
    clock.time = 10;
    startTransition('fade');
    clock.time = 10.2;
    expect(drawsOverlay()).toBe(true);
    startTransition('cut');
    expect(drawsOverlay()).toBe(false);
  });
});
