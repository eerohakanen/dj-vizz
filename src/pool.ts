export function createPool<T>(capacity: number, create: () => T) {
  const items = Array.from({ length: capacity }, create);
  let active = 0;
  let cursor = -1;
  return {
    items,
    get active() {
      return active;
    },
    acquire() {
      if (active < capacity) return items[active++];
      cursor = (cursor + 1) % capacity;
      return items[cursor];
    },
    release(index: number) {
      active--;
      const released = items[index];
      items[index] = items[active];
      items[active] = released;
    },
  };
}
