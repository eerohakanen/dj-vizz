import { describe, expect, it } from 'vitest';
import { createPool } from './pool';

const counterPool = (capacity: number) => {
  let created = 0;
  const pool = createPool(capacity, () => ({ id: created++, value: 0 }));
  return { pool, created: () => created };
};

describe('createPool', () => {
  it('preallocates every slot up front', () => {
    const { pool, created } = counterPool(5);
    expect(created()).toBe(5);
    expect(pool.items).toHaveLength(5);
    expect(pool.active).toBe(0);
  });

  it('hands out distinct slots until full', () => {
    const { pool } = counterPool(3);
    const acquired = [pool.acquire(), pool.acquire(), pool.acquire()];
    expect(new Set(acquired).size).toBe(3);
    expect(pool.active).toBe(3);
  });

  it('releases by swapping with the last active slot', () => {
    const { pool } = counterPool(4);
    const [first, second, third] = [pool.acquire(), pool.acquire(), pool.acquire()];
    pool.release(0);
    expect(pool.active).toBe(2);
    expect(pool.items.slice(0, pool.active)).toEqual([third, second]);
    expect(pool.items[2]).toBe(first);
  });

  it('reuses released slots without creating objects', () => {
    const { pool, created } = counterPool(2);
    const first = pool.acquire();
    pool.acquire();
    pool.release(0);
    pool.release(0);
    expect(pool.active).toBe(0);
    const reused = [pool.acquire(), pool.acquire()];
    expect(reused).toContain(first);
    expect(created()).toBe(2);
  });

  it('never grows past capacity and recycles active slots in turn when full', () => {
    const { pool, created } = counterPool(3);
    const slots = [pool.acquire(), pool.acquire(), pool.acquire()];
    expect([pool.acquire(), pool.acquire(), pool.acquire(), pool.acquire()]).toEqual([slots[0], slots[1], slots[2], slots[0]]);
    expect(pool.active).toBe(3);
    expect(pool.items).toHaveLength(3);
    expect(created()).toBe(3);
  });
});
