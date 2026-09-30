import { settings } from '../state';
import { audio } from './input';
import { averageBins } from './spectrum';

const HISTORY = 32;

type Range = [number, number, number];

interface OnsetDetector {
  ranges: Range[];
  sensitivity: number;
  refractory: number;
  previous: number;
  history: Float32Array;
  cursor: number;
  lastOnset: number;
}

const createDetector = (ranges: Range[], sensitivity: number, refractory: number): OnsetDetector => ({
  ranges,
  sensitivity,
  refractory,
  previous: 0,
  history: new Float32Array(HISTORY),
  cursor: 0,
  lastOnset: -1,
});

const kickDetector = createDetector([[45, 110, 1]], 1.6, 0.16);
const snareDetector = createDetector([[170, 260, 0.35], [2000, 5000, 0.65]], 1.8, 0.1);
const hatDetector = createDetector([[8000, 12000, 1]], 1.9, 0.06);

const drumHits = { kick: 0, snare: 0, hat: 0, snareTimes: [] as number[] };

function toBin(hz: number, binCount: number) {
  return Math.min(binCount - 1, Math.max(1, Math.round((hz * binCount * 2) / audio.sampleRate)));
}

function rangeLevel(frequencies: Uint8Array, [lowHz, highHz, weight]: Range) {
  const from = toBin(lowHz, frequencies.length);
  const to = Math.max(from + 1, toBin(highHz, frequencies.length));
  return averageBins(frequencies, from, to) * weight;
}

function detectOnset(detector: OnsetDetector, frequencies: Uint8Array, time: number) {
  let level = 0;
  for (const range of detector.ranges) level += rangeLevel(frequencies, range);
  const flux = Math.max(0, level - detector.previous);
  detector.previous = level;

  const { history } = detector;
  let mean = 0;
  for (let i = 0; i < HISTORY; i++) mean += history[i];
  mean /= HISTORY;
  let variance = 0;
  for (let i = 0; i < HISTORY; i++) variance += (history[i] - mean) ** 2;
  const deviation = Math.sqrt(variance / HISTORY);
  history[detector.cursor] = flux;
  detector.cursor = (detector.cursor + 1) % HISTORY;

  const threshold = mean + (detector.sensitivity / settings.beatSensitivity) * deviation + 0.012;
  if (flux < threshold || level < 0.2 || time - detector.lastOnset < detector.refractory) return 0;
  detector.lastOnset = time;
  return Math.min(1, 0.4 + (flux - threshold) / (deviation * 4 + 0.02));
}

export function detectDrums(time: number, gate: number) {
  const frequencies = audio.sharpFrequencies;
  const kick = detectOnset(kickDetector, frequencies, time);
  const snare = detectOnset(snareDetector, frequencies, time);
  const hat = detectOnset(hatDetector, frequencies, time);
  const open = gate > 0.3;
  drumHits.kick = open ? kick : 0;
  drumHits.snare = open ? snare : 0;
  drumHits.hat = open ? hat : 0;
  if (drumHits.snare) drumHits.snareTimes.push(time);
  while (drumHits.snareTimes.length && time - drumHits.snareTimes[0] > 2) drumHits.snareTimes.shift();
  return drumHits;
}
