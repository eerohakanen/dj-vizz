import { describe, expect, it } from 'vitest';
import { TUNING_SECTIONS, tuningSectionsFor } from './tuning';

describe('tuningSectionsFor', () => {
  it('keeps only calibration sections while playing', () => {
    const groups = tuningSectionsFor('play').map((section) => section.group);
    expect(groups.length).toBeGreaterThan(0);
    expect(new Set(groups)).toEqual(new Set(['calibration']));
  });

  it('leaves effect-specific sections to the effects panel while exploring or editing', () => {
    const shown = TUNING_SECTIONS.filter((section) => section.placement !== 'effects');
    expect(shown.length).toBeLessThan(TUNING_SECTIONS.length);
    expect(tuningSectionsFor('explore')).toEqual(shown);
    expect(tuningSectionsFor('edit')).toEqual(shown);
  });
});
