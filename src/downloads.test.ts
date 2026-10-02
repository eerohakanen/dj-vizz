import { describe, expect, it } from 'vitest';
import { downloadsFor } from './downloads';

const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

describe('downloadsFor', () => {
  it('offers the Windows installer on every desktop', () => {
    expect(downloadsFor(MAC).map((download) => download.platform)).toEqual(['windows']);
    expect(downloadsFor(WINDOWS).map((download) => download.platform)).toEqual(['windows']);
  });

  it('offers nothing on phones', () => {
    expect(downloadsFor(IPHONE)).toEqual([]);
  });

  it('links to the latest release assets', () => {
    expect(downloadsFor(WINDOWS)[0].url).toBe('https://github.com/eerohakanen/dj-vizz/releases/latest/download/DJ-Visualizer-windows.exe');
  });
});
