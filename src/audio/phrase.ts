import { clamp01 } from '../math';

const RING = 16;
const BARS_PER_PHRASE = 8;
const BEFORE_BARS = 4;
const AFTER_BARS = 2;
const LEVEL_WEIGHT = 1.5;
const NOVELTY_FLOOR = 0.15;
const NOVELTY_RANGE = 0.6;
const VOTE_DECAY = 0.96;
const SHIFT_MARGIN = 0.9;
const ANCHOR_VOTE = 2;
const BASE_STRENGTH = 0.35;
const KICKS_PER_BAR = 4;
const SNARES_PER_BAR = 4;
const HATS_PER_BAR = 8;

const FEATURES = ['bass', 'mid', 'high', 'brightness', 'vocal', 'kicks', 'snares', 'hats'] as const;
const WEIGHTS = [LEVEL_WEIGHT, LEVEL_WEIGHT, LEVEL_WEIGHT, 1, 1, 1, 1, 1];
const FEATURE_COUNT = FEATURES.length;
const KICKS = FEATURES.indexOf('kicks');
const SNARES = FEATURES.indexOf('snares');
const HATS = FEATURES.indexOf('hats');

export interface PhraseFrame {
  locked: boolean;
  downbeat: boolean;
  barInPhrase: number;
  bass: number;
  mid: number;
  high: number;
  brightness: number;
  vocal: number;
  kick: number;
  snare: number;
  hat: number;
  tension: number;
}

export interface PhraseState {
  bars: Float32Array;
  filled: number;
  newest: number;
  sums: Float32Array;
  frames: number;
  votes: Float32Array;
  previousRaw: number;
  olderRaw: number;
  novelty: number;
  cue: number;
  lastShift: number;
}

export const createPhraseState = (): PhraseState => ({
  bars: new Float32Array(RING * FEATURE_COUNT),
  filled: 0,
  newest: 0,
  sums: new Float32Array(FEATURE_COUNT),
  frames: 0,
  votes: new Float32Array(BARS_PER_PHRASE),
  previousRaw: 0,
  olderRaw: 0,
  novelty: 0,
  cue: 0,
  lastShift: 0,
});

export const phraseState = createPhraseState();

const barOffset = (state: PhraseState, back: number) => ((state.newest - back + RING) % RING) * FEATURE_COUNT;

function clearBar(state: PhraseState) {
  state.sums.fill(0);
  state.frames = 0;
}

export function resetPhrase(state: PhraseState) {
  state.filled = 0;
  state.previousRaw = state.olderRaw = 0;
  state.novelty = 0;
  state.cue = 0;
  state.votes.fill(0);
  clearBar(state);
}

export function anchorPhraseVotes(state: PhraseState) {
  state.votes.fill(0);
  state.votes[0] = ANCHOR_VOTE;
  state.previousRaw = state.olderRaw = 0;
  clearBar(state);
}

function accumulate(state: PhraseState, frame: PhraseFrame) {
  const { sums } = state;
  sums[0] += frame.bass;
  sums[1] += frame.mid;
  sums[2] += frame.high;
  sums[3] += frame.brightness;
  sums[4] += frame.vocal;
  if (frame.kick) sums[KICKS]++;
  if (frame.snare) sums[SNARES]++;
  if (frame.hat) sums[HATS]++;
  state.frames++;
}

function closeBar(state: PhraseState) {
  const { sums, frames } = state;
  state.newest = (state.newest + 1) % RING;
  const offset = barOffset(state, 0);
  for (let i = 0; i < KICKS; i++) state.bars[offset + i] = frames ? sums[i] / frames : 0;
  state.bars[offset + KICKS] = clamp01(sums[KICKS] / KICKS_PER_BAR);
  state.bars[offset + SNARES] = clamp01(sums[SNARES] / SNARES_PER_BAR);
  state.bars[offset + HATS] = clamp01(sums[HATS] / HATS_PER_BAR);
  state.filled = Math.min(RING, state.filled + 1);
  clearBar(state);
}

function meanFeature(state: PhraseState, feature: number, from: number, count: number) {
  let total = 0;
  for (let back = from; back < from + count; back++) total += state.bars[barOffset(state, back) + feature];
  return total / count;
}

function distanceFromBefore(state: PhraseState, back: number) {
  let sum = 0;
  for (let feature = 0; feature < FEATURE_COUNT; feature++) {
    const before = meanFeature(state, feature, AFTER_BARS, BEFORE_BARS);
    sum += WEIGHTS[feature] * (state.bars[barOffset(state, back) + feature] - before) ** 2;
  }
  return Math.sqrt(sum);
}

function boundaryDistance(state: PhraseState) {
  let lasting = Infinity;
  for (let back = 0; back < AFTER_BARS; back++) lasting = Math.min(lasting, distanceFromBefore(state, back));
  return lasting;
}

function measureCue(state: PhraseState, tension: number) {
  const last = barOffset(state, 0);
  const kicks = meanFeature(state, KICKS, 1, BEFORE_BARS);
  const snares = meanFeature(state, SNARES, 1, BEFORE_BARS);
  const kickGap = kicks > 0.5 ? clamp01(1 - state.bars[last + KICKS] / kicks) : 0;
  const snareFill = clamp01((state.bars[last + SNARES] - snares) * 2);
  return Math.max(kickGap, snareFill, tension);
}

function rotateVotes(state: PhraseState, bars: number) {
  const previous = state.votes.slice();
  for (let i = 0; i < BARS_PER_PHRASE; i++) state.votes[i] = previous[(i + bars) % BARS_PER_PHRASE];
}

function bestOffset(votes: Float32Array) {
  let best = 0;
  for (let i = 1; i < BARS_PER_PHRASE; i++) if (votes[i] > votes[best]) best = i;
  return best;
}

const noveltyOf = (raw: number) => clamp01((raw - NOVELTY_FLOOR) / NOVELTY_RANGE);

function voteBoundary(state: PhraseState, barInPhrase: number) {
  const raw = boundaryDistance(state);
  const peak = state.previousRaw;
  const isPeak = peak > raw && peak >= state.olderRaw;
  state.olderRaw = peak;
  state.previousRaw = raw;
  state.novelty = noveltyOf(raw);
  for (let i = 0; i < BARS_PER_PHRASE; i++) state.votes[i] *= VOTE_DECAY;
  if (!isPeak || noveltyOf(peak) <= 0) return 0;
  const boundaryBar = (barInPhrase - AFTER_BARS - 1 + BARS_PER_PHRASE) % BARS_PER_PHRASE;
  state.votes[boundaryBar] += noveltyOf(peak);
  const best = bestOffset(state.votes);
  if (best === 0 || state.votes[best] - state.votes[0] < SHIFT_MARGIN) return 0;
  rotateVotes(state, best);
  return best;
}

export function phraseAlignment(state: PhraseState) {
  let total = 0;
  for (let i = 0; i < BARS_PER_PHRASE; i++) total += state.votes[i];
  return (state.votes[0] + 0.5) / (total + 1);
}

export const phraseStrength = (state: PhraseState) => phraseAlignment(state) * (BASE_STRENGTH + (1 - BASE_STRENGTH) * state.cue);

export function stepPhrase(state: PhraseState, frame: PhraseFrame) {
  if (!frame.locked) {
    if (state.filled || state.frames) resetPhrase(state);
    return 0;
  }
  if (frame.downbeat && state.frames) {
    closeBar(state);
    state.cue = state.filled > BEFORE_BARS ? measureCue(state, frame.tension) : frame.tension;
    if (state.filled >= AFTER_BARS + BEFORE_BARS) {
      const shift = voteBoundary(state, frame.barInPhrase);
      if (shift) state.lastShift = shift;
      accumulate(state, frame);
      return shift;
    }
  }
  accumulate(state, frame);
  return 0;
}
