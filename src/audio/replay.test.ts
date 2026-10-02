import { describe, expect, it } from 'vitest';
import { createAnalyser, decodeWav, readFrequencies } from './replay';

const SAMPLE_RATE = 48000;

function sine(hz: number, length: number, amplitude = 0.5) {
  return Float32Array.from({ length }, (_, i) => amplitude * Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE));
}

function wav16(samples: Float32Array, channels = 1) {
  const data = samples.length * 2 * channels;
  const view = new DataView(new ArrayBuffer(44 + data));
  const write = (offset: number, text: string) => [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + data, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2 * channels, true);
  view.setUint16(32, 2 * channels, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, data, true);
  samples.forEach((sample, i) => {
    for (let channel = 0; channel < channels; channel++) view.setInt16(44 + (i * channels + channel) * 2, Math.round(sample * 32767), true);
  });
  return view.buffer;
}

describe('decodeWav', () => {
  it('reads 16-bit PCM', () => {
    const { sampleRate, samples } = decodeWav(wav16(Float32Array.from([0, 0.5, -0.5])));
    expect(sampleRate).toBe(SAMPLE_RATE);
    expect([...samples].map((sample) => Number(sample.toFixed(3)))).toEqual([0, 0.5, -0.5]);
  });

  it('mixes stereo down to mono', () => {
    expect(decodeWav(wav16(Float32Array.from([0.5]), 2)).samples[0]).toBeCloseTo(0.5, 3);
  });

  it('rejects files that are not WAV', () => {
    expect(() => decodeWav(new ArrayBuffer(16))).toThrow('Not a WAV file');
  });
});

describe('readFrequencies', () => {
  it('peaks at the bin of a sine', () => {
    const out = new Uint8Array(1024);
    const bin = 43;
    readFrequencies(createAnalyser(0), sine((bin * SAMPLE_RATE) / 2048, 2048, 0.005), out);
    expect(Math.max(...out)).toBeLessThan(255);
    expect(out.indexOf(Math.max(...out))).toBe(bin);
  });

  it('reads silence as zero', () => {
    const out = new Uint8Array(1024).fill(9);
    readFrequencies(createAnalyser(0), new Float32Array(2048), out);
    expect(Math.max(...out)).toBe(0);
  });
});
