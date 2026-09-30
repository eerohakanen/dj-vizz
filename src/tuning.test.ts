import { describe, expect, it } from 'vitest';
import { TUNING_SECTIONS, tuningSectionsFor } from './tuning';

describe('tuningSectionsFor', () => {
  it('keeps only calibration sections while playing', () => {
    const groups = tuningSectionsFor('play').map((section) => section.group);
    expect(groups.length).toBeGreaterThan(0);
    expect(new Set(groups)).toEqual(new Set(['calibration']));
  });

  it('shows every section while exploring or editing', () => {
    expect(tuningSectionsFor('explore')).toEqual(TUNING_SECTIONS);
    expect(tuningSectionsFor('edit')).toEqual(TUNING_SECTIONS);
  });
});
