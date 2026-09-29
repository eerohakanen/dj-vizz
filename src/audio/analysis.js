import { $ } from '../dom.js';
import { onBeat, triggerDrop } from '../events.js';
import { clock, fx, settings, signal } from '../state.js';
import { audio } from './input.js';
import { BAND_COUNT, spectrum } from './spectrum.js';

const bandStart = new Int16Array(BAND_COUNT);
const bandEnd = new Int16Array(BAND_COUNT);
for (let i = 0; i < BAND_COUNT; i++) {
  bandStart[i] = Math.floor(Math.pow(i / BAND_COUNT, 2.1) * 380) + 1;
  bandEnd[i] = Math.max(bandStart[i] + 1, Math.floor(Math.pow((i + 1) / BAND_COUNT, 2.1) * 380) + 1);
}

let rawPeak = 0.1;
let autoGainFactor = 1;
let previousBass = 0;
let frameCount = 0;

function averageBins(frequencies, from, to) {
  let sum = 0;
  for (let i = from; i < to; i++) sum += frequencies[i];
  return sum / (to - from) / 255;
}

const removeNoiseFloor = (level) => Math.max(0, (level - 0.06) * 1.15);

function readInput() {
  const { analyser, frequencies, waveform } = audio;
  if (audio.live && analyser) {
    analyser.getByteFrequencyData(frequencies);
    analyser.getByteTimeDomainData(waveform);
  } else {
    frequencies.fill(0);
    waveform.fill(128);
  }
  return frequencies;
}

function computeGain(raw, delta) {
  rawPeak = Math.max(raw, rawPeak - delta * 0.02, 0.04);
  const target = Math.min(12, Math.max(0.3, 0.42 / rawPeak));
  autoGainFactor += (target - autoGainFactor) * Math.min(1, delta * (target < autoGainFactor ? 6 : 0.8));
  return 0.2 * Math.pow(50, settings.gain / 100) * (settings.autoGain ? autoGainFactor : 1);
}

function decayEffects(delta) {
  fx.beat *= Math.pow(0.002, delta);
  fx.drop *= Math.pow(0.4, delta);
  fx.flash *= Math.pow(0.02, delta);
  fx.shake *= Math.pow(0.02, delta);
  fx.strobeFlash *= Math.pow(0.00005, delta);
  fx.invert *= Math.pow(0.0001, delta);
  fx.glitchAmount *= Math.pow(0.01, delta);
}

function fillSpectrum(frequencies, gain) {
  const boost = 1 + (fx.beat * 0.4 + fx.drop * 0.7) * settings.reactivity;
  for (let i = 0; i < BAND_COUNT; i++) {
    let max = 0;
    for (let j = bandStart[i]; j < bandEnd[i]; j++) if (frequencies[j] > max) max = frequencies[j];
    const level = Math.max(0, max / 255 - 0.08) * gain * 1.2;
    spectrum[i] = Math.min(1.25, Math.pow(level, 1.3) * 1.3 * signal.gate * boost);
  }
}

export function analyse() {
  const { delta, time } = clock;
  const frequencies = readInput();
  const rawBass = averageBins(frequencies, 1, 9);
  const rawMid = averageBins(frequencies, 9, 100);
  const rawHigh = averageBins(frequencies, 100, 400);
  const gain = computeGain(rawBass * 0.5 + rawMid * 0.35 + rawHigh * 0.15, delta);
  signal.gainFactor = gain;

  const bass = removeNoiseFloor(rawBass) * gain;
  const mid = removeNoiseFloor(rawMid) * gain;
  const high = removeNoiseFloor(rawHigh) * gain * 1.6;
  const energy = Math.min(1, bass * 0.5 + mid * 0.35 + high * 0.15);
  signal.energy += (energy - signal.energy) * Math.min(1, delta * 8);
  signal.energySlow += (energy - signal.energySlow) * Math.min(1, delta * 0.5);
  signal.energyPeak = Math.max(signal.energy, signal.energyPeak - delta * 0.05);
  signal.gate = Math.min(1, Math.max(0, (signal.energy - 0.03) / 0.07));

  const { gate } = signal;
  const react = settings.reactivity;
  signal.bass = Math.min(1.2, bass * gate);
  signal.mid = Math.min(1.2, mid * gate);
  signal.high = Math.min(1.2, high * gate);
  const flux = signal.bass - previousBass;
  previousBass = signal.bass;
  signal.bassAverage = signal.bassAverage * 0.94 + signal.bass * 0.06;
  signal.punchBass = Math.min(1.8, (signal.bass + Math.max(0, signal.bass - signal.bassAverage) * 2.5) * react);
  signal.punchMid = Math.min(1.8, signal.mid * react);
  signal.punchHigh = Math.min(1.8, signal.high * react * 1.2);

  decayEffects(delta);
  fx.spin += delta * gate * (0.1 + signal.energy * 2 + fx.drop * 4) * react;
  fx.scroll += delta * gate * (0.2 + signal.energy * 3 + fx.drop * 8) * react;
  const inBreakdown = signal.energy < 0.4 * signal.energyPeak && signal.energyPeak > 0.15;
  signal.breakdown = inBreakdown ? signal.breakdown + delta : Math.max(0, signal.breakdown - delta * 2);

  const isBeat = signal.bass > signal.bassAverage * 1.2 + 0.06 && flux > 0.012 && time - signal.lastBeat > 0.2 && gate > 0.3;
  if (isBeat) {
    fx.beat = Math.min(1, 0.55 + (signal.bass - signal.bassAverage) * 2);
    signal.lastBeat = time;
    onBeat();
  }
  const surge = signal.bass > signal.bassAverage * 2.2 && signal.energy > signal.energySlow * 1.7 && signal.energy > 0.35;
  if (time - signal.lastDrop > 3 && signal.bass > 0.5 && (signal.breakdown > 0.7 || surge)) triggerDrop();

  fillSpectrum(frequencies, gain);
  if (++frameCount % 10 === 0) $('gv').textContent = (settings.autoGain ? 'A ' : '') + '×' + gain.toFixed(gain < 1 ? 2 : 1);
}
