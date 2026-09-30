import Meyda from 'meyda';
import { fx, signal } from '../state';
import { audio } from './input';

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const KEY_WINDOW = 8;
const KEY_HOLD = 2;
const KEY_HUE_SPEED = 0.6;
const SILENCE_RMS = 0.01;

const chroma = new Float32Array(12);
const smoothed = { highFast: 0, highSlow: 0, brightFast: 0.5, brightSlow: 0.5, tensionPeak: 0 };
let candidateKey = -1;
let candidateSince = 0;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const ease = (value: number, target: number, rate: number) => value + (target - value) * Math.min(1, rate);

function correlate(profile: number[], tonic: number) {
  let meanChroma = 0;
  let meanProfile = 0;
  for (let i = 0; i < 12; i++) {
    meanChroma += chroma[i] / 12;
    meanProfile += profile[i] / 12;
  }
  let product = 0;
  let chromaSpread = 0;
  let profileSpread = 0;
  for (let i = 0; i < 12; i++) {
    const c = chroma[(i + tonic) % 12] - meanChroma;
    const p = profile[i] - meanProfile;
    product += c * p;
    chromaSpread += c * c;
    profileSpread += p * p;
  }
  return chromaSpread > 0 ? product / Math.sqrt(chromaSpread * profileSpread) : 0;
}

function estimateKey() {
  let best = -1;
  let bestScore = 0;
  for (let tonic = 0; tonic < 12; tonic++) {
    const major = correlate(MAJOR_PROFILE, tonic);
    const minor = correlate(MINOR_PROFILE, tonic);
    if (major > bestScore) [best, bestScore] = [tonic, major];
    if (minor > bestScore) [best, bestScore] = [tonic + 12, minor];
  }
  return { key: best, score: bestScore };
}

function keyHue(key: number) {
  const majorTonic = key >= 12 ? (key - 12 + 3) % 12 : key;
  return ((majorTonic * 7) % 12) * 30;
}

function followKey(time: number, delta: number) {
  const { key, score } = estimateKey();
  signal.keyConfidence = ease(signal.keyConfidence, score, delta);
  if (key !== candidateKey) {
    candidateKey = key;
    candidateSince = time;
  }
  if (score > 0.5 && time - candidateSince > KEY_HOLD) signal.key = candidateKey;
  if (signal.key < 0) return;
  const step = ((((keyHue(signal.key) - fx.keyHue) % 360) + 540) % 360) - 180;
  fx.keyHue = (fx.keyHue + step * Math.min(1, delta * KEY_HUE_SPEED) + 360) % 360;
}

function bandShare(spectrum: Float32Array, lowHz: number, highHz: number) {
  const binHz = audio.sampleRate / Meyda.bufferSize;
  const from = Math.max(1, Math.round(lowHz / binHz));
  const to = Math.min(spectrum.length, Math.round(highHz / binHz));
  let band = 0;
  let total = 0;
  for (let i = 1; i < spectrum.length; i++) {
    total += spectrum[i];
    if (i >= from && i < to) band += spectrum[i];
  }
  return total > 0 ? band / total : 0;
}

function followTension(delta: number, snareRate: number) {
  smoothed.highFast = ease(smoothed.highFast, signal.high, delta * 1.5);
  smoothed.highSlow = ease(smoothed.highSlow, signal.high, delta * 0.15);
  smoothed.brightFast = ease(smoothed.brightFast, signal.brightness, delta * 1.5);
  smoothed.brightSlow = ease(smoothed.brightSlow, signal.brightness, delta * 0.15);
  const highRise = Math.max(0, smoothed.highFast - smoothed.highSlow * 1.05);
  const brightRise = Math.max(0, smoothed.brightFast - smoothed.brightSlow - 0.02);
  const roll = clamp01((snareRate - 2.5) / 4);
  const target = clamp01(highRise * 3 + brightRise * 4 + roll * 0.6 + (signal.breakdown > 1 ? 0.2 : 0));
  signal.tension = ease(signal.tension, target, delta * (target > signal.tension ? 0.6 : 1.5));
  smoothed.tensionPeak = Math.max(signal.tension, smoothed.tensionPeak - delta * 0.15);
}

export const tensionPeak = () => smoothed.tensionPeak;

export function releaseTension() {
  signal.tension = 0;
  smoothed.tensionPeak = 0;
}

export function analyseMusic(time: number, delta: number, snareRate: number) {
  if (!audio.live) {
    signal.vocal = ease(signal.vocal, 0, delta * 2);
    followTension(delta, 0);
    return;
  }
  Meyda.bufferSize = audio.samples.length;
  Meyda.sampleRate = audio.sampleRate;
  const features = Meyda.extract(['rms', 'spectralCentroid', 'spectralFlatness', 'chroma', 'amplitudeSpectrum'], audio.samples);
  if (!features || (features.rms ?? 0) < SILENCE_RMS) {
    followTension(delta, snareRate);
    return;
  }

  const centroidHz = ((features.spectralCentroid ?? 0) * audio.sampleRate) / Meyda.bufferSize;
  signal.brightness = ease(signal.brightness, clamp01(Math.log2(Math.max(1, centroidHz) / 400) / 4), delta * 2);

  const frame = features.chroma ?? [];
  for (let i = 0; i < 12; i++) chroma[i] = ease(chroma[i], frame[i] ?? 0, delta / KEY_WINDOW);
  followKey(time, delta);

  const midShare = bandShare(features.amplitudeSpectrum!, 300, 3000);
  const tonal = clamp01((0.3 - (features.spectralFlatness ?? 1)) / 0.25);
  const vocal = clamp01((midShare - 0.3) / 0.3) * tonal * signal.gate;
  signal.vocal = ease(signal.vocal, vocal, delta * (vocal > signal.vocal ? 1.5 : 0.7));

  followTension(delta, snareRate);
}
