import { describe, expect, it } from 'vitest';
import { KEY_CONFIDENCE_FLOOR, keyHue, keyPalette, keyTintOffset, keyTintStrength, paletteHue, rankPalettesByHue } from './color';
import { PALETTES } from './palettes';

const indexOf = (name: string) => PALETTES.findIndex((palette) => palette.name === name);

describe('keyHue', () => {
  it('places major keys around the circle of fifths', () => {
    expect(keyHue(0)).toBe(0);
    expect(keyHue(7)).toBe(30);
    expect(keyHue(2)).toBe(60);
    expect(keyHue(5)).toBe(330);
  });

  it('gives a minor key the hue of its relative major', () => {
    expect(keyHue(12 + 9)).toBe(keyHue(0));
    expect(keyHue(12 + 4)).toBe(keyHue(7));
  });

  it('gives every major key a distinct hue', () => {
    const hues = Array.from({ length: 12 }, (_, key) => keyHue(key));
    expect(new Set(hues).size).toBe(12);
  });
});

describe('keyTintStrength', () => {
  it('is zero at or below the confidence floor', () => {
    expect(keyTintStrength(0)).toBe(0);
    expect(keyTintStrength(KEY_CONFIDENCE_FLOOR)).toBe(0);
  });

  it('reaches full strength at high confidence', () => {
    expect(keyTintStrength(0.8)).toBe(1);
    expect(keyTintStrength(1)).toBe(1);
  });

  it('rises monotonically in between', () => {
    expect(keyTintStrength(0.6)).toBeGreaterThan(0);
    expect(keyTintStrength(0.7)).toBeGreaterThan(keyTintStrength(0.6));
    expect(keyTintStrength(0.7)).toBeLessThan(1);
  });
});

describe('keyTintOffset', () => {
  it('rotates towards the key hue', () => {
    expect(keyTintOffset(0, 30)).toBeGreaterThan(0);
    expect(keyTintOffset(0, 330)).toBeLessThan(0);
  });

  it('never rotates more than 40 degrees', () => {
    for (let hue = 0; hue < 360; hue += 15) expect(Math.abs(keyTintOffset(100, hue))).toBeLessThanOrEqual(40);
    expect(keyTintOffset(0, 90)).toBeCloseTo(40);
  });

  it('leaves a palette alone when it already matches the key', () => {
    expect(keyTintOffset(200, 200)).toBeCloseTo(0);
  });

  it('does not tint palettes without a dominant hue', () => {
    expect(keyTintOffset(null, 90)).toBe(0);
  });
});

describe('paletteHue', () => {
  it('finds the dominant hue of a warm palette', () => {
    expect(paletteHue(PALETTES[indexOf('Fire')])).toBeCloseTo(20, 0);
  });

  it('averages across the 0 degree seam', () => {
    const hue = paletteHue({ name: 'Seam', stops: [[350, 100, 50], [10, 100, 50]] });
    expect(Math.min(hue!, 360 - hue!)).toBeCloseTo(0);
  });

  it('ignores unsaturated stops', () => {
    expect(paletteHue({ name: 'Mixed', stops: [[120, 100, 50], [300, 0, 90]] })).toBeCloseTo(120);
  });

  it('has no hue for rainbow or greyscale palettes', () => {
    expect(paletteHue(PALETTES[indexOf('Rainbow')])).toBeNull();
    expect(paletteHue(PALETTES[indexOf('Mono')])).toBeNull();
  });
});

describe('rankPalettesByHue', () => {
  it('orders palettes by hue distance to the target', () => {
    expect(rankPalettesByHue(20, -1)[0]).toBe(indexOf('Fire'));
    expect(rankPalettesByHue(120, -1)[0]).toBe(indexOf('Toxic'));
    expect(rankPalettesByHue(200, -1).slice(0, 2)).toEqual([indexOf('Ocean'), indexOf('Ice')]);
  });

  it('excludes the given palette and hueless palettes', () => {
    const ranked = rankPalettesByHue(20, indexOf('Fire'));
    expect(ranked).not.toContain(indexOf('Fire'));
    expect(ranked).not.toContain(indexOf('Rainbow'));
    expect(ranked).not.toContain(indexOf('Mono'));
    expect(ranked).toHaveLength(PALETTES.length - 3);
  });
});

describe('keyPalette', () => {
  it('picks among the three nearest palettes', () => {
    const nearest = rankPalettesByHue(200, indexOf('Ocean')).slice(0, 3);
    expect(keyPalette(200, indexOf('Ocean'), () => 0)).toBe(nearest[0]);
    expect(keyPalette(200, indexOf('Ocean'), () => 0.5)).toBe(nearest[1]);
    expect(keyPalette(200, indexOf('Ocean'), () => 0.99)).toBe(nearest[2]);
  });

  it('never returns the current palette', () => {
    for (let step = 0; step < 10; step++) expect(keyPalette(20, indexOf('Fire'), () => step / 10)).not.toBe(indexOf('Fire'));
  });
});
