import { describe, expect, it } from 'vitest';
import { pluralize } from './utils';

describe('pluralize', () => {
  it('keeps the word singular for exactly one', () => {
    expect(pluralize(1, 'preset')).toBe('1 preset');
  });

  it('adds an s for zero and many', () => {
    expect(pluralize(0, 'preset')).toBe('0 presets');
    expect(pluralize(2, 'folder')).toBe('2 folders');
  });
});
