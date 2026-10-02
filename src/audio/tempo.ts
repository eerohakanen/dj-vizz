import { clamp01, wrap } from '../math';
import { signal } from '../state';

const MIN_BPM = 88;
const HISTOGRAM_SIZE = 64;
const HISTOGRAM_HALF_LIFE = 6;
const LOCK_CONFIDENCE = 0.35;
const LEAD = 0.04;
const PHASE_PULL = 0.25;
const PEAK_WIDTH = 3;
const MIN_FREE_BEAT_GAP = 0.25;
export const BEATS_PER_BAR = 4;
const BEATS_PER_PHRASE = 32;
const PERIOD_HOLD = 60;

const histogram = new Float32Array(HISTOGRAM_SIZE);
const kickTimes: number[] = [];
const snareByPosition = new Float32Array(BEATS_PER_BAR);
const kickByPosition = new Float32Array(BEATS_PER_BAR);

let period = 0.5;
let nextBeat = 0;
let lastGridBeat = -1;
let lastKick = -9;
let kickStrength = 0;
let locked = false;
let lastLockedAt = -Infinity;
let candidateShift = 0;
let candidateBars = 0;

export const beatPhaseAt = (now: number, upcomingBeat: number, beatPeriod: number) => clamp01(1 - (upcomingBeat - now) / beatPeriod);

export const barPhaseAt = (beatInBar: number, beatPhase: number) => (beatInBar + beatPhase) / BEATS_PER_BAR;

const wrapBin = (bin: number) => wrap(bin, HISTOGRAM_SIZE);

const binOf = (bpm: number) => wrapBin(Math.log2(bpm / MIN_BPM) * HISTOGRAM_SIZE);

const bpmOf = (bin: number) => MIN_BPM * Math.pow(2, wrapBin(bin) / HISTOGRAM_SIZE);

function vote(interval: number, weight: number) {
  if (interval < 0.2 || interval > 2) return;
  const position = binOf(60 / interval);
  const bin = position | 0;
  const fraction = position - bin;
  histogram[bin] += weight * (1 - fraction);
  histogram[wrapBin(bin + 1)] += weight * fraction;
}

function readHistogram() {
  let best = 0;
  let total = 0;
  for (let i = 0; i < HISTOGRAM_SIZE; i++) {
    total += histogram[i];
    if (histogram[i] > histogram[best]) best = i;
  }
  const left = histogram[wrapBin(best - 1)];
  const right = histogram[wrapBin(best + 1)];
  const curvature = left - 2 * histogram[best] + right;
  const offset = curvature < 0 ? (0.5 * (left - right)) / curvature : 0;
  let peak = 0;
  for (let i = best - PEAK_WIDTH; i <= best + PEAK_WIDTH; i++) peak += histogram[wrapBin(i)];
  const share = total > 0 ? peak / total : 0;
  return { bpm: bpmOf(best + offset), confidence: Math.min(1, Math.max(0, (share - 0.3) / 0.4)), mass: total };
}

function refinePeriod(coarse: number) {
  const origin = kickTimes[0];
  let count = 0;
  let sumIndex = 0;
  let sumTime = 0;
  let sumIndexTime = 0;
  let sumIndexSquared = 0;
  for (const time of kickTimes) {
    const position = (time - origin) / coarse;
    const index = Math.round(position);
    if (Math.abs(position - index) > 0.25) continue;
    count++;
    sumIndex += index;
    sumTime += time;
    sumIndexTime += index * time;
    sumIndexSquared += index * index;
  }
  const spread = count * sumIndexSquared - sumIndex * sumIndex;
  if (count < 6 || spread <= 0) return coarse;
  const fitted = (count * sumIndexTime - sumIndex * sumTime) / spread;
  return Math.abs(fitted - coarse) / coarse < 0.04 ? fitted : coarse;
}

function registerKick(time: number, strength: number) {
  for (let back = 1; back <= 2 && back <= kickTimes.length; back++) {
    vote(time - kickTimes[kickTimes.length - back], strength / back);
  }
  kickTimes.push(time);
  if (kickTimes.length > 16) kickTimes.shift();
  lastKick = time;
  kickStrength += (strength - kickStrength) * 0.3;
}

function pullPhase(time: number) {
  const nearest = Math.abs(time - lastGridBeat) < Math.abs(nextBeat - time) ? lastGridBeat : nextBeat;
  const error = time - nearest;
  if (Math.abs(error) < period * 0.15) nextBeat += error * PHASE_PULL;
}

function nearestPosition(time: number) {
  return time - lastGridBeat < period / 2 ? signal.beatInBar : (signal.beatInBar + 1) % BEATS_PER_BAR;
}

function downbeatScore(offset: number) {
  const at = (step: number) => (offset + step) % BEATS_PER_BAR;
  const backbeat = snareByPosition[at(1)] + snareByPosition[at(3)] - snareByPosition[at(0)] - snareByPosition[at(2)];
  return backbeat + 0.3 * (kickByPosition[at(0)] - kickByPosition[at(2)]);
}

function realignDownbeat() {
  let best = 0;
  for (let offset = 1; offset < BEATS_PER_BAR; offset++) if (downbeatScore(offset) > downbeatScore(best)) best = offset;
  const clear = best !== 0 && downbeatScore(best) - downbeatScore(0) > 1.5;
  candidateBars = clear && best === candidateShift ? candidateBars + 1 : clear ? 1 : 0;
  candidateShift = clear ? best : 0;
  if (candidateBars < 2) return;
  shiftCounters(best);
  candidateShift = candidateBars = 0;
}

function shiftCounters(offset: number) {
  signal.beatInBar = (signal.beatInBar - offset + BEATS_PER_BAR) % BEATS_PER_BAR;
  signal.phraseBeat = (signal.phraseBeat - offset + BEATS_PER_PHRASE) % BEATS_PER_PHRASE;
  const snare = snareByPosition.slice();
  const kick = kickByPosition.slice();
  for (let i = 0; i < BEATS_PER_BAR; i++) {
    snareByPosition[i] = snare[(i + offset) % BEATS_PER_BAR];
    kickByPosition[i] = kick[(i + offset) % BEATS_PER_BAR];
  }
}

function countBeat() {
  signal.beatInBar = (signal.beatInBar + 1) % BEATS_PER_BAR;
  signal.phraseBeat = (signal.phraseBeat + 1) % BEATS_PER_PHRASE;
  if (signal.beatInBar !== 0) return;
  for (let i = 0; i < BEATS_PER_BAR; i++) {
    snareByPosition[i] *= 0.85;
    kickByPosition[i] *= 0.85;
  }
  if (locked) realignDownbeat();
}

export function shiftPhrase(bars: number) {
  signal.phraseBeat = wrap(signal.phraseBeat - bars * BEATS_PER_BAR, BEATS_PER_PHRASE);
}

export function anchorPhrase() {
  signal.beatInBar = 0;
  signal.phraseBeat = 0;
  snareByPosition.fill(0);
  kickByPosition.fill(0);
  candidateShift = candidateBars = 0;
}

export const isLocked = () => locked;

export const heldBeatPeriod = (time: number) => (locked || time - lastLockedAt < PERIOD_HOLD ? period : 0);

export function beatStrength(time: number) {
  const kicking = time - lastKick < period * 2.5;
  const accent = signal.beatInBar === 0 ? 0.1 : 0;
  return (kicking ? 0.5 + kickStrength * 0.45 : 0.3) + accent;
}

export function advanceTempo(time: number, delta: number, kick: number, snare: number) {
  const fired = stepTempo(time, delta, kick, snare);
  signal.downbeat = fired && locked && signal.beatInBar === 0;
  signal.beatPhase = locked ? beatPhaseAt(time, nextBeat, period) : 0;
  signal.barPhase = locked ? barPhaseAt(signal.beatInBar, signal.beatPhase) : 0;
  return fired;
}

function stepTempo(time: number, delta: number, kick: number, snare: number) {
  const decay = Math.pow(0.5, delta / HISTOGRAM_HALF_LIFE);
  for (let i = 0; i < HISTOGRAM_SIZE; i++) histogram[i] *= decay;
  if (kick) registerKick(time, kick);
  const reading = readHistogram();
  const wasLocked = locked;
  locked = reading.confidence > (wasLocked ? LOCK_CONFIDENCE * 0.7 : LOCK_CONFIDENCE) && reading.mass > 2;
  signal.tempoConfidence = reading.confidence;
  if (locked) {
    lastLockedAt = time;
    const target = refinePeriod(60 / reading.bpm);
    const drift = Math.abs(target - period) / period;
    period = drift > 0.08 ? target : period + (target - period) * Math.min(1, delta * 2);
    signal.bpm = 60 / period;
  } else {
    signal.bpm = 0;
  }

  if (locked && !wasLocked) {
    nextBeat = lastKick + period;
    while (nextBeat - LEAD < time) nextBeat += period;
  }

  if (kick) {
    const position = nearestPosition(time);
    kickByPosition[position] += kick;
    if (locked) pullPhase(time);
  }
  if (snare && locked) snareByPosition[nearestPosition(time)] += snare;

  if (!locked) {
    if (!kick || time - lastGridBeat < MIN_FREE_BEAT_GAP) return false;
    lastGridBeat = time;
    countBeat();
    return true;
  }
  if (time < nextBeat - LEAD) return false;
  lastGridBeat = nextBeat;
  nextBeat += period;
  if (nextBeat - LEAD < time) nextBeat = time + period;
  countBeat();
  return true;
}
