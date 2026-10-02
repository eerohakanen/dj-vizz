import Meyda from 'meyda';
import { clamp } from '../math';
import { clock } from '../state';
import { analyse, type AnalysisEvents } from './analysis';
import { audio } from './input';

const FFT_SIZE = 2048;
const MIN_DB = -100;
const MAX_DB = -30;
const FRAME_RATE = 60;
const SMOOTH_ANALYSER = 0.7;
const SHARP_ANALYSER = 0.15;
const WAVE_FORMAT_PCM = 1;
const WAVE_FORMAT_FLOAT = 3;
const WAVE_FORMAT_EXTENSIBLE = 0xfffe;

export interface Pcm {
  sampleRate: number;
  samples: Float32Array;
}

export interface AnalyserEmulator {
  smoothing: number;
  previous: Float32Array;
}

function readSample(view: DataView, offset: number, bits: number, float: boolean) {
  if (float) return bits === 64 ? view.getFloat64(offset, true) : view.getFloat32(offset, true);
  if (bits === 8) return (view.getUint8(offset) - 128) / 128;
  if (bits === 16) return view.getInt16(offset, true) / 32768;
  if (bits === 24) return ((view.getInt8(offset + 2) << 16) | view.getUint16(offset, true)) / 8388608;
  return view.getInt32(offset, true) / 2147483648;
}

export function decodeWav(buffer: ArrayBuffer): Pcm {
  const view = new DataView(buffer);
  const tag = (offset: number) => String.fromCharCode(...new Uint8Array(buffer, offset, 4));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Not a WAV file');
  let format = 0;
  let channels = 0;
  let sampleRate = 0;
  let bits = 0;
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      format = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bits = view.getUint16(body + 14, true);
      if (format === WAVE_FORMAT_EXTENSIBLE) format = view.getUint16(body + 24, true);
    } else if (id === 'data') {
      if (format !== WAVE_FORMAT_PCM && format !== WAVE_FORMAT_FLOAT) throw new Error(`Unsupported WAV format ${format}`);
      const stride = (bits / 8) * channels;
      const length = Math.floor(Math.min(size, view.byteLength - body) / stride);
      const samples = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        let sum = 0;
        for (let channel = 0; channel < channels; channel++) sum += readSample(view, body + i * stride + (channel * bits) / 8, bits, format === WAVE_FORMAT_FLOAT);
        samples[i] = sum / channels;
      }
      return { sampleRate, samples };
    }
    offset = body + size + (size % 2);
  }
  throw new Error('WAV file has no data chunk');
}

export const createAnalyser = (smoothing: number): AnalyserEmulator => ({ smoothing, previous: new Float32Array(FFT_SIZE / 2) });

export function readFrequencies(analyser: AnalyserEmulator, window: Float32Array, out: Uint8Array) {
  const { smoothing, previous } = analyser;
  const windowing = Meyda.windowingFunction;
  Meyda.bufferSize = FFT_SIZE;
  Meyda.windowingFunction = 'blackman';
  const spectrum = Meyda.extract('amplitudeSpectrum', window) as unknown as Float32Array;
  Meyda.windowingFunction = windowing;
  for (let bin = 0; bin < previous.length; bin++) {
    previous[bin] = smoothing * previous[bin] + (1 - smoothing) * (spectrum[bin] / FFT_SIZE);
    const decibels = 20 * Math.log10(previous[bin]);
    out[bin] = clamp(Math.floor((255 * (decibels - MIN_DB)) / (MAX_DB - MIN_DB)), 0, 255);
  }
}

export function replay({ sampleRate, samples }: Pcm, events: AnalysisEvents, onFrame?: (time: number) => void) {
  const smooth = createAnalyser(SMOOTH_ANALYSER);
  const sharp = createAnalyser(SHARP_ANALYSER);
  const window = new Float32Array(FFT_SIZE);
  audio.external = true;
  audio.live = true;
  audio.sampleRate = sampleRate;
  audio.frequencies = new Uint8Array(FFT_SIZE / 2);
  audio.sharpFrequencies = new Uint8Array(FFT_SIZE / 2);
  audio.waveform = new Uint8Array(FFT_SIZE);
  audio.samples = new Float32Array(FFT_SIZE);
  clock.delta = 1 / FRAME_RATE;
  for (let frame = 1; ; frame++) {
    const end = Math.round((frame * sampleRate) / FRAME_RATE);
    if (end > samples.length) break;
    window.fill(0);
    const start = Math.max(0, end - FFT_SIZE);
    window.set(samples.subarray(start, end), FFT_SIZE - (end - start));
    readFrequencies(smooth, window, audio.frequencies);
    readFrequencies(sharp, window, audio.sharpFrequencies);
    for (let i = 0; i < FFT_SIZE; i++) audio.waveform[i] = clamp(Math.round(128 * (1 + window[i])), 0, 255);
    audio.samples.set(window);
    clock.time = end / sampleRate;
    analyse(events);
    onFrame?.(clock.time);
  }
}
