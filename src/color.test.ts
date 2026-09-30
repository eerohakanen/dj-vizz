import { beforeEach, describe, expect, it } from 'vitest';
import {
  advancePaletteFade,
  buildLut,
  color,
  colorHsl,
  KEY_CONFIDENCE_FLOOR,
  keyHue,
  keyPalette,
  keyTintOffset,
  keyTintStrength,
  paletteHue,
  rankPalettesByHue,
  setPalette,
  styleKey,
} from './color';
import { PALETTES } from './palettes';
import { fx, signal } from './state';

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

describe('styleKey', () => {
  it('shares a key for alphas that round to the same thousandth', () => {
    expect(styleKey(200, 90, 50, 0.5)).toBe(styleKey(200, 90, 50, 0.5004));
    expect(styleKey(200, 90, 50, 0.5)).not.toBe(styleKey(200, 90, 50, 0.502));
  });

  it('clamps alpha to the unit interval', () => {
    expect(styleKey(10, 20, 30, -0.4)).toBe(styleKey(10, 20, 30, 0));
    expect(styleKey(10, 20, 30, 3)).toBe(styleKey(10, 20, 30, 1));
  });

  it('gives every hue, saturation, lightness and alpha step its own key', () => {
    const keys = new Set<number>();
    for (const hue of [0, 1, 359]) {
      for (const saturation of [0, 1, 100]) {
        for (const lightness of [5, 6, 95]) {
          for (const alpha of [0, 0.001, 1]) keys.add(styleKey(hue, saturation, lightness, alpha));
        }
      }
    }
    expect(keys.size).toBe(81);
  });
});

describe('buildLut', () => {
  beforeEach(() => {
    setPalette(3, true);
    advancePaletteFade(10);
    signal.key = 0;
    signal.keyConfidence = 1;
    fx.keyHue = 100;
    buildLut();
  });

  it('skips the rebuild when nothing changed', () => {
    expect(buildLut()).toBe(false);
  });

  it('ignores key hue drift below the quantization step', () => {
    fx.keyHue = 100.2;
    expect(buildLut()).toBe(false);
    fx.keyHue = 101;
    expect(buildLut()).toBe(true);
  });

  it('rebuilds when the key tint strength or mode changes', () => {
    signal.keyConfidence = 0.65;
    expect(buildLut()).toBe(true);
    signal.key = 12;
    expect(buildLut()).toBe(true);
    signal.key = -1;
    expect(buildLut()).toBe(true);
  });

  it('rebuilds on every step of a palette crossfade and stops once it settles', () => {
    setPalette(5, true);
    expect(buildLut()).toBe(true);
    advancePaletteFade(0.5);
    expect(buildLut()).toBe(true);
    advancePaletteFade(0.5);
    expect(buildLut()).toBe(true);
    advancePaletteFade(10);
    expect(buildLut()).toBe(true);
    expect(buildLut()).toBe(false);
  });

  it('serves colours that follow the rebuilt table', () => {
    fx.hue = 0;
    fx.beat = 0;
    signal.brightness = 0.5;
    const before = color(0);
    setPalette(5, true);
    advancePaletteFade(10);
    buildLut();
    const hsl = colorHsl(0);
    expect(color(0)).not.toBe(before);
    expect(color(0)).toBe(`hsla(${hsl[0]},${hsl[1]}%,${hsl[2]}%,1.000)`);
  });
});
