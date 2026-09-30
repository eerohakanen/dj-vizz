import { describe, expect, it } from 'vitest';
import { markDataUrl, markSvg } from './brand';

describe('markSvg', () => {
  it('paints only the middle bar with the live colour', () => {
    const svg = markSvg('hsl(120 100% 50%)');
    expect(svg.match(/hsl\(120 100% 50%\)/g)).toHaveLength(1);
    expect(svg).toContain('d="M32 13v38" stroke="hsl(120 100% 50%)"');
  });

  it('encodes into a data url', () => {
    expect(decodeURIComponent(markDataUrl('#ff3b30').replace('data:image/svg+xml,', ''))).toBe(markSvg('#ff3b30'));
  });
});
