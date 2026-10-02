import { describe, expect, it } from 'vitest';
import { TUNING_SECTIONS, tuningSectionsFor } from './tuning';

describe('tuningSectionsFor', () => {
  it('keeps only Input and Detection while playing', () => {
    expect(tuningSectionsFor('play').map((section) => section.title)).toEqual(['Input', 'Detection']);
  });

  it('leaves effect-specific sections to the effects panel while exploring or editing', () => {
    const shown = TUNING_SECTIONS.filter((section) => section.placement !== 'effects');
    expect(shown.length).toBeLessThan(TUNING_SECTIONS.length);
    expect(tuningSectionsFor('explore')).toEqual(shown);
    expect(tuningSectionsFor('edit')).toEqual(shown);
  });
});
