import { approach, decay, follow, frameScale, lerp, stretch, updatePeak } from '../math';
import { clock, fx, settings, signal, TUNING_DEFAULTS } from '../state';
import { detectDrums } from './drums';
import { type DropFrame, dropState, stepDrop } from './drop';
import { audio } from './input';
import { analyseMusic, tensionPeak } from './musical';
import { averageBins, BAND_COUNT, spectrum } from './spectrum';
import { advanceTempo, beatStrength, heldBeatPeriod, isLocked } from './tempo';

const SPECTRUM_ATTACK = 0.03;
const SPECTRUM_RELEASE = 0.1;
const BEAT_BOOST = 0.1;
const DROP_BOOST = 0.05;
const CALM_RISE = 0.8;
const CALM_FALL = 2.5;
const FLOOR_RISE = 4;
const FLOOR_FALL = 0.3;
const PEAK_FALL = 0.15;
const BAND_MIN_RANGE = 0.12;
const LEVEL_MIN_RANGE = 0.1;
const STRETCH_HEADROOM = 1.1;

export interface AnalysisEvents {
  onBeat(): void;
  onKick(strength: number): void;
  onSnare(strength: number): void;
  onHat(strength: number): void;
  onDrop(): void;
}

interface LevelRange {
  floor: number;
  peak: number;
}

const bassRange: LevelRange = { floor: 0, peak: 0 };
const midRange: LevelRange = { floor: 0, peak: 0 };
const highRange: LevelRange = { floor: 0, peak: 0 };
const bandFloor = new Float32Array(BAND_COUNT);
const bandPeak = new Float32Array(BAND_COUNT);

const trackFloor = (floor: number, level: number, delta: number) => follow(floor, level, FLOOR_RISE, FLOOR_FALL, delta);

function emphasise(range: LevelRange, level: number, delta: number) {
  range.floor = trackFloor(range.floor, level, delta);
  range.peak = updatePeak(range.peak, level, PEAK_FALL, delta);
  return lerp(level, stretch(level, range.floor, range.peak, LEVEL_MIN_RANGE) * STRETCH_HEADROOM, settings.contrast);
}

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
  if (audio.external) return frequencies;
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
    const raw = Math.max(0, max / 255 - 0.08) * gain * 1.2;
    bandFloor[i] = trackFloor(bandFloor[i], raw, delta);
    bandPeak[i] = updatePeak(bandPeak[i], raw, PEAK_FALL, delta);
    const level = lerp(raw, stretch(raw, bandFloor[i], bandPeak[i], BAND_MIN_RANGE), settings.contrast);
    const target = Math.min(1.25, Math.pow(level, 1.3) * 1.3 * signal.gate * boost);
    spectrum[i] = follow(spectrum[i], target, SPECTRUM_ATTACK, SPECTRUM_RELEASE, delta);
  }
}

const dropFrame: DropFrame = {
  time: 0,
  delta: 0,
  kick: 0,
  kickLevel: 0,
  fullLevel: 0,
  tension: 0,
  period: 0,
  locked: false,
  phraseBeat: 0,
  beatInBar: 0,
};

function readDropFrame(kick: number, kickLevel: number, fullLevel: number) {
  dropFrame.time = clock.time;
  dropFrame.delta = clock.delta;
  dropFrame.kick = kick;
  dropFrame.kickLevel = kickLevel;
  dropFrame.fullLevel = fullLevel;
  dropFrame.tension = tensionPeak();
  dropFrame.period = heldBeatPeriod(clock.time);
  dropFrame.locked = isLocked();
  dropFrame.phraseBeat = signal.phraseBeat;
  dropFrame.beatInBar = signal.beatInBar;
  return dropFrame;
}

export function analyse(events: AnalysisEvents) {
  const { delta, time } = clock;
  const frequencies = readInput();
  const rawBass = averageBins(frequencies, 1, 9);
  const rawMid = averageBins(frequencies, 9, 100);
  const rawHigh = averageBins(frequencies, 100, 400);
  const rawFull = rawBass * 0.5 + rawMid * 0.35 + rawHigh * 0.15;
  const gain = computeGain(rawFull, delta);
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
  signal.bass = Math.min(1.2, emphasise(bassRange, bass, delta) * gate);
  signal.mid = Math.min(1.2, emphasise(midRange, mid, delta) * gate);
  signal.high = Math.min(1.2, emphasise(highRange, high, delta) * gate);
  signal.bassAverage = lerp(signal.bass, signal.bassAverage, decay(0.94, frameScale(delta)));
  signal.punchBass = Math.min(1.8, (signal.bass + Math.max(0, signal.bass - signal.bassAverage) * 4) * react);
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
  if (hits.kick) events.onKick(hits.kick);
  if (hits.snare) events.onSnare(hits.snare);
  if (hits.hat) events.onHat(hits.hat);
  analyseMusic(time, delta, hits.snareTimes.length / 2);

  if (advanceTempo(time, delta, hits.kick, hits.snare) && gate > 0.3) {
    fx.beat = Math.min(1, beatStrength(time));
    signal.lastBeat = time;
    events.onBeat();
  }
  if (stepDrop(dropState, readDropFrame(hits.kick, hits.kickLevel, rawFull), settings.dropSensitivity)) events.onDrop();

  fillSpectrum(frequencies, gain, delta);
}
