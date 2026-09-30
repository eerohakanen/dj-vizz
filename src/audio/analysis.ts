import { onBeat, onHat, onKick, onSnare, triggerDrop } from '../events';
import { approach, decay, follow, frameScale, lerp } from '../math';
import { clock, fx, settings, signal, TUNING_DEFAULTS } from '../state';
import { detectDrums } from './drums';
import { audio } from './input';
import { analyseMusic, tensionPeak } from './musical';
import { averageBins, BAND_COUNT, spectrum } from './spectrum';
import { advanceTempo, beatStrength } from './tempo';

const DROP_COOLDOWN = 8;
const SPECTRUM_ATTACK = 0.03;
const SPECTRUM_RELEASE = 0.18;
const BEAT_BOOST = 0.1;
const DROP_BOOST = 0.05;
const CALM_RISE = 0.8;
const CALM_FALL = 2.5;

const bandStart = new Int16Array(BAND_COUNT);
const bandEnd = new Int16Array(BAND_COUNT);
for (let i = 0; i < BAND_COUNT; i++) {
  bandStart[i] = Math.floor(Math.pow(i / BAND_COUNT, 2.1) * 380) + 1;
  bandEnd[i] = Math.max(bandStart[i] + 1, Math.floor(Math.pow((i + 1) / BAND_COUNT, 2.1) * 380) + 1);
}

let rawPeak = 0.1;
let autoGainFactor = 1;

const removeNoiseFloor = (level: number) => Math.max(0, (level - 0.06) * 1.15);

function readInput() {
  const { analyser, detector, frequencies, sharpFrequencies, waveform, samples } = audio;
  if (audio.live && analyser && detector) {
    analyser.getByteFrequencyData(frequencies);
    analyser.getByteTimeDomainData(waveform);
    detector.getByteFrequencyData(sharpFrequencies);
    detector.getFloatTimeDomainData(samples);
  } else {
    frequencies.fill(0);
    sharpFrequencies.fill(0);
    waveform.fill(128);
    samples.fill(0);
  }
  return frequencies;
}

function computeGain(raw: number, delta: number) {
  rawPeak = Math.max(raw, rawPeak - delta * 0.02, 0.04);
  const target = Math.min(12, Math.max(0.3, 0.42 / rawPeak));
  autoGainFactor = approach(autoGainFactor, target, target < autoGainFactor ? 6 : 0.8, delta);
  return 0.2 * Math.pow(50, settings.gain / 100) * (settings.autoGain ? autoGainFactor : 1);
}

function decayEffects(delta: number) {
  fx.beat *= decay(0.002, delta);
  fx.drop *= decay(0.4, delta);
  fx.flash *= decay(0.02, delta);
  fx.shake *= decay(0.02, delta);
  fx.strobeFlash *= decay(0.00005, delta);
  fx.invert *= decay(0.0001, delta);
  fx.glitchAmount *= decay(0.01, delta);
  fx.kick *= decay(0.004, delta);
  fx.snare *= decay(0.002, delta);
  fx.hat *= decay(0.0005, delta);
}

function fillSpectrum(frequencies: Uint8Array, gain: number, delta: number) {
  const boost = 1 + (fx.beat * BEAT_BOOST + fx.drop * DROP_BOOST) * (settings.reactivity / TUNING_DEFAULTS.reactivity);
  for (let i = 0; i < BAND_COUNT; i++) {
    let max = 0;
    for (let j = bandStart[i]; j < bandEnd[i]; j++) if (frequencies[j] > max) max = frequencies[j];
    const level = Math.max(0, max / 255 - 0.08) * gain * 1.2;
    const target = Math.min(1.25, Math.pow(level, 1.3) * 1.3 * signal.gate * boost);
    spectrum[i] = follow(spectrum[i], target, SPECTRUM_ATTACK, SPECTRUM_RELEASE, delta);
  }
}

function isDropReturning(kick: number) {
  const sensitivity = settings.dropSensitivity;
  if (sensitivity <= 0) return false;
  const released = tensionPeak() > 0.45 / sensitivity && signal.energy > signal.energySlow * (1 + 0.2 / sensitivity);
  return kick > 0.5 && signal.bass > 0.5 && (released || signal.breakdown > 0.7 / sensitivity);
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
  signal.energy = approach(signal.energy, energy, 8, delta);
  signal.energySlow = approach(signal.energySlow, energy, 0.5, delta);
  signal.energyPeak = Math.max(signal.energy, signal.energyPeak - delta * 0.05);
  signal.gate = Math.min(1, Math.max(0, (signal.energy - settings.noiseGate) / 0.07));

  const { gate } = signal;
  const react = settings.reactivity;
  const motion = react * settings.motion;
  signal.bass = Math.min(1.2, bass * gate);
  signal.mid = Math.min(1.2, mid * gate);
  signal.high = Math.min(1.2, high * gate);
  signal.bassAverage = lerp(signal.bass, signal.bassAverage, decay(0.94, frameScale(delta)));
  signal.punchBass = Math.min(1.8, (signal.bass + Math.max(0, signal.bass - signal.bassAverage) * 2.5) * react);
  signal.punchMid = Math.min(1.8, signal.mid * react);
  signal.punchHigh = Math.min(1.8, signal.high * react * 1.2);

  decayEffects(delta);
  fx.spin += delta * gate * (0.1 + signal.energy * 2 + fx.drop * 4) * motion;
  fx.scroll += delta * gate * (0.2 + signal.energy * 3 + fx.drop * 8) * motion;
  const inBreakdown = signal.energy < 0.4 * signal.energyPeak && signal.energyPeak > 0.15;
  signal.breakdown = inBreakdown ? signal.breakdown + delta : Math.max(0, signal.breakdown - delta * 2);

  const calming = inBreakdown && fx.drop < 0.3;
  fx.calm = approach(fx.calm, calming ? 1 : 0, calming ? CALM_RISE : CALM_FALL, delta);

  const hits = detectDrums(time, gate);
  if (hits.kick) onKick(hits.kick);
  if (hits.snare) onSnare(hits.snare);
  if (hits.hat) onHat(hits.hat);
  analyseMusic(time, delta, hits.snareTimes.length / 2);

  if (advanceTempo(time, delta, hits.kick, hits.snare) && gate > 0.3) {
    fx.beat = Math.min(1, beatStrength(time));
    signal.lastBeat = time;
    onBeat();
  }
  if (time - signal.lastDrop > DROP_COOLDOWN && isDropReturning(hits.kick)) triggerDrop();

  fillSpectrum(frequencies, gain, delta);
}
