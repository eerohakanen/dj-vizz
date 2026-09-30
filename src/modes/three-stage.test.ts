import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showWarning } from '../dom';
import { lazyStage } from './three-stage';

vi.mock('../dom', () => ({ showWarning: vi.fn() }));
vi.mock('../canvas', () => ({ BACKGROUND: '#000', createCanvas: vi.fn(), sceneCtx: {} }));

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => vi.clearAllMocks());

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
    expect(load).toHaveBeenCalledTimes(2);
    lazy.get();
    await settle();
    expect(lazy.get()).toBe('stage');
    expect(load).toHaveBeenCalledTimes(3);
    expect(showWarning).toHaveBeenCalledTimes(1);
  });
});
