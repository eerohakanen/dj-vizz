import { describe, expect, it, vi } from 'vitest';
import { tuningGroupNote } from './labels';

vi.mock('@/audio/input', () => ({ WINDOW_UNSUPPORTED: '', canCaptureWindow: true, captureMicrophone: vi.fn(), captureWindow: vi.fn() }));

describe('tuningGroupNote', () => {
  it('mentions saving with the scene only while editing', () => {
    expect(tuningGroupNote('look', 'edit')).toBe('Saved with each scene.');
    expect(tuningGroupNote('look', 'explore')).toBe('');
    expect(tuningGroupNote('look', 'play')).toBe('');
  });

  it('always notes that calibration stays on the device', () => {
    expect(tuningGroupNote('calibration', 'explore')).toBe('Remembered on this device.');
    expect(tuningGroupNote('calibration', 'edit')).toBe('Remembered on this device.');
  });
});
