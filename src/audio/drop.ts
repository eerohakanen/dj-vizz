import { clamp, clamp01, follow } from '../math';
import { clock, signal } from '../state';
import { releaseTension } from './musical';
import { anchorPhrase } from './tempo';

const DB_RANGE = 70;
const SLOTS = 32;
const UNLOCKED_SLOT = 0.5;
const PRE_FROM = 1;
const PRE_TO = 7;
const MIN_REDUCED = 2;
const FULL_REDUCED = 16;
const REDUCED_DROP_DB = 6;
const MIN_GROOVE = 0.4;
const GROOVE_RISE = 2;
const GROOVE_FALL = 30;
const RECENT_FRAMES = 3;
const GAP_FRAMES = 64;
const GAP_BEATS = 0.75;
const SPARSE_KICKS = 0.6;
const COOLDOWN_BEATS = 16;
const UNLOCKED_COOLDOWN = 8;
const BASE_THRESHOLD = 0.62;
const THRESHOLD_PER_SENSITIVITY = 0.2;
const PENDING_MARGIN = 0.12;

const WEIGHTS = { low: 0.28, kick: 0.2, groove: 0.14, full: 0.1, build: 0.12, length: 0.1, phrase: 0.06 };

export interface DropFrame {
  time: number;
  delta: number;
  kick: number;
  kickLevel: number;
  fullLevel: number;
  tension: number;
  period: number;
  locked: boolean;
  phraseBeat: number;
  beatInBar: number;
}

interface PreDrop {
  low: number;
  kicks: number;
  full: number;
  reduced: number;
}

export interface DropState {
  lowMax: Float32Array;
  fullMean: Float32Array;
  kicks: Uint8Array;
  newest: number;
  filled: number;
  slotStart: number;
  slotLow: number;
  slotFull: number;
  slotFrames: number;
  slotKicks: number;
  groove: number;
  reduced: number;
  recent: Float32Array;
  gapTimes: Float64Array;
  gapLevels: Float32Array;
  gapCursor: number;
  frameCount: number;
  pre: PreDrop;
  pendingUntil: number;
  lastDrop: number;
  level: number;
  score: number;
}

export const createDropState = (): DropState => ({
  lowMax: new Float32Array(SLOTS),
  fullMean: new Float32Array(SLOTS),
  kicks: new Uint8Array(SLOTS),
  newest: 0,
  filled: 0,
  slotStart: 0,
  slotLow: 0,
  slotFull: 0,
  slotFrames: 0,
  slotKicks: 0,
  groove: 0,
  reduced: 0,
  recent: new Float32Array(RECENT_FRAMES),
  gapTimes: new Float64Array(GAP_FRAMES),
  gapLevels: new Float32Array(GAP_FRAMES),
  gapCursor: 0,
  frameCount: 0,
  pre: { low: 0, kicks: 0, full: 0, reduced: 0 },
  pendingUntil: -Infinity,
  lastDrop: -Infinity,
  level: 0,
  score: 0,
});

export const dropState = createDropState();

const decibels = (level: number) => level * DB_RANGE;

export const dropThreshold = (sensitivity: number) => clamp(BASE_THRESHOLD - THRESHOLD_PER_SENSITIVITY * (sensitivity - 1), 0.38, 0.9);

export const isDropArmed = (state: DropState) => state.groove >= MIN_GROOVE && state.reduced >= MIN_REDUCED;

export function resetDrop(state: DropState, time: number) {
  state.reduced = 0;
  state.pendingUntil = -Infinity;
  state.lastDrop = time;
}

export function registerDrop() {
  signal.lastDrop = clock.time;
  signal.breakdown = 0;
  anchorPhrase();
  releaseTension();
  resetDrop(dropState, clock.time);
  signal.energyPeak = signal.energy;
}

function closeSlot(state: DropState) {
  const low = state.slotLow;
  const kicks = state.slotKicks;
  state.newest = (state.newest + 1) % SLOTS;
  state.lowMax[state.newest] = low;
  state.fullMean[state.newest] = state.slotFrames ? state.slotFull / state.slotFrames : 0;
  state.kicks[state.newest] = Math.min(255, kicks);
  state.filled = Math.min(SLOTS, state.filled + 1);
  const reduced = kicks === 0 || decibels(state.groove - low) > REDUCED_DROP_DB;
  state.reduced = reduced ? state.reduced + 1 : 0;
  state.slotLow = state.slotFull = state.slotFrames = state.slotKicks = 0;
}

function advanceSlot(state: DropState, { time, kick, kickLevel, fullLevel, period }: DropFrame) {
  const length = period || UNLOCKED_SLOT;
  if (time < state.slotStart) state.slotStart = time;
  if (time - state.slotStart >= length) {
    if (state.slotKicks > 0) state.groove = follow(state.groove, state.slotLow, GROOVE_RISE, GROOVE_FALL, length);
    closeSlot(state);
    state.slotStart += length;
    if (time - state.slotStart >= length) state.slotStart = time;
  }
  state.slotLow = Math.max(state.slotLow, kickLevel);
  state.slotFull += fullLevel;
  state.slotFrames++;
  if (kick > 0) state.slotKicks++;
}

function remember(state: DropState, { time, kickLevel, fullLevel }: DropFrame) {
  state.recent[state.frameCount % RECENT_FRAMES] = kickLevel;
  state.gapTimes[state.gapCursor] = time;
  state.gapLevels[state.gapCursor] = fullLevel;
  state.gapCursor = (state.gapCursor + 1) % GAP_FRAMES;
  state.frameCount++;
}

function recentLow(state: DropState) {
  let max = 0;
  for (let i = 0; i < RECENT_FRAMES; i++) max = Math.max(max, state.recent[i]);
  return max;
}

function gapMinimum(state: DropState, time: number, window: number) {
  let min = Infinity;
  for (let i = 0; i < GAP_FRAMES; i++) if (time - state.gapTimes[i] <= window) min = Math.min(min, state.gapLevels[i]);
  return min === Infinity ? 0 : min;
}

function measurePre(state: DropState) {
  const { pre } = state;
  const count = Math.min(PRE_TO, state.filled - 1) - PRE_FROM + 1;
  pre.low = pre.kicks = pre.full = 0;
  pre.reduced = state.reduced;
  if (count <= 0) return;
  for (let back = PRE_FROM; back < PRE_FROM + count; back++) {
    const slot = (state.newest - back + SLOTS) % SLOTS;
    pre.low += state.lowMax[slot] / count;
    pre.kicks += state.kicks[slot] / count;
    pre.full += state.fullMean[slot] / count;
  }
}

function phraseBonus({ locked, phraseBeat, beatInBar }: DropFrame, reduced: number) {
  if (!locked) return 0;
  const boundary = phraseBeat === 0 ? 1 : beatInBar === 0 ? 0.5 : 0;
  return Math.min(1, boundary + (reduced % 8 <= 1 ? 0.3 : 0));
}

function scoreDrop(state: DropState, frame: DropFrame) {
  const { pre } = state;
  const low = recentLow(state);
  const gap = gapMinimum(state, frame.time, (frame.period || UNLOCKED_SLOT) * GAP_BEATS);
  const lowJump = clamp01(decibels(low - pre.low) / 12);
  const kickAbsence = clamp01(1 - pre.kicks / SPARSE_KICKS);
  const grooveReturn = clamp01(1 - decibels(state.groove - low) / 8);
  const fullRise = clamp01(decibels(frame.fullLevel - pre.full) / 8);
  const build = Math.max(clamp01(decibels(pre.full - gap) / 10), frame.tension);
  const length = clamp01((pre.reduced - MIN_REDUCED) / (FULL_REDUCED - MIN_REDUCED));
  return (
    WEIGHTS.low * lowJump +
    WEIGHTS.kick * kickAbsence +
    WEIGHTS.groove * grooveReturn +
    WEIGHTS.full * fullRise +
    WEIGHTS.build * build +
    WEIGHTS.length * length +
    WEIGHTS.phrase * phraseBonus(frame, pre.reduced)
  );
}

function cooledDown(state: DropState, { time, period, locked }: DropFrame) {
  return time - state.lastDrop > (locked && period ? period * COOLDOWN_BEATS : UNLOCKED_COOLDOWN);
}

export function stepDrop(state: DropState, frame: DropFrame, sensitivity: number) {
  advanceSlot(state, frame);
  remember(state, frame);
  state.level = frame.kickLevel;
  const pending = frame.time <= state.pendingUntil;
  if (!pending) state.pendingUntil = -Infinity;
  if (sensitivity <= 0 || frame.kick <= 0 || state.groove < MIN_GROOVE || !cooledDown(state, frame)) return false;
  if (!pending) {
    if (state.reduced < MIN_REDUCED) return false;
    measurePre(state);
  }
  state.score = scoreDrop(state, frame);
  const threshold = dropThreshold(sensitivity);
  if (state.score >= threshold) {
    resetDrop(state, frame.time);
    return true;
  }
  if (!pending && state.score >= threshold - PENDING_MARGIN) state.pendingUntil = frame.time + (frame.period || UNLOCKED_SLOT);
  return false;
}
