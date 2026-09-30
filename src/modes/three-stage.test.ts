import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showWarning } from '../dom';
import { clock, signal } from '../state';
import { advanceSway, lazyStage, sway } from './three-stage';

vi.mock('../dom', () => ({ showWarning: vi.fn() }));
vi.mock('../canvas', () => ({ BACKGROUND: '#000', createCanvas: vi.fn(), sceneCtx: {} }));

const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => vi.useRealTimers());

describe('lazyStage', () => {
  it('starts loading on first get and caches the result', async () => {
    const load = vi.fn().mockResolvedValue('stage');
    const lazy = lazyStage(load);
    expect(lazy.get()).toBeUndefined();
    lazy.get();
    await settle();
    expect(lazy.get()).toBe('stage');
    expect(lazy.get()).toBe('stage');
    expect(load).toHaveBeenCalledTimes(1);
    expect(showWarning).not.toHaveBeenCalled();
  });

  it('resets after a failure so it retries, and warns once', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline')).mockResolvedValue('stage');
    const lazy = lazyStage(load);
    lazy.get();
    await settle();
    expect(lazy.get()).toBeUndefined();
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    lazy.get();
    await settle();
    expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5000);
    lazy.get();
    await settle();
    expect(lazy.get()).toBe('stage');
    expect(load).toHaveBeenCalledTimes(3);
    expect(showWarning).toHaveBeenCalledTimes(1);
  });
});

describe('sway', () => {
  beforeEach(() => vi.useRealTimers());

  it('has no discontinuity across an unlock', () => {
    const samples: number[] = [];
    const run = (frames: number, locked: boolean) => {
      for (let i = 0; i < frames; i++) {
        clock.time += clock.delta;
        signal.bpm = locked ? 124 : 0;
        signal.phraseBeat = locked ? Math.floor(i / 30) % 32 : (i * 7) % 32;
        signal.beatPhase = locked ? (i % 30) / 30 : 0;
        advanceSway();
        samples.push(sway(0.09, 2));
      }
    };
    run(400, true);
    run(200, false);
    let largest = 0;
    for (let i = 1; i < samples.length; i++) largest = Math.max(largest, Math.abs(samples[i] - samples[i - 1]));
    expect(largest).toBeLessThan(0.05);
  });
});
