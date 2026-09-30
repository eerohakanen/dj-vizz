import { describe, expect, it } from 'vitest';
import { accentStyle, hslLuminance, legibleLightness } from './accent';

const BLACK_TEXT_MIN_LUMINANCE = 0.175;

describe('hslLuminance', () => {
  it('matches the WCAG luminance of pure colours', () => {
    expect(hslLuminance(0, 0, 100)).toBeCloseTo(1);
    expect(hslLuminance(0, 0, 0)).toBeCloseTo(0);
    expect(hslLuminance(0, 100, 50)).toBeCloseTo(0.2126);
    expect(hslLuminance(120, 100, 50)).toBeCloseTo(0.7152);
    expect(hslLuminance(240, 100, 50)).toBeCloseTo(0.0722);
  });
});

describe('legibleLightness', () => {
  it('keeps black text readable at AA on every hue', () => {
    for (let hue = 0; hue < 360; hue += 5) {
      for (const saturation of [0, 60, 100]) {
        const lightness = legibleLightness(hue, saturation);
        expect(hslLuminance(hue, saturation, lightness)).toBeGreaterThanOrEqual(BLACK_TEXT_MIN_LUMINANCE);
      }
    }
  });

  it('lifts dark hues and leaves bright hues fully saturated', () => {
    expect(legibleLightness(60, 100)).toBe(50);
    expect(legibleLightness(240, 100)).toBeGreaterThan(70);
  });
});

describe('accentStyle', () => {
  it('snaps nearby hues to the same style so the page is not restyled every frame', () => {
    expect(accentStyle(121, 100)).toBe(accentStyle(120, 100));
    expect(accentStyle(359.4, 100)).toBe(accentStyle(0, 100));
  });

  it('formats an hsl colour', () => {
    expect(accentStyle(60, 100)).toBe('hsl(60 100% 50%)');
  });
});
