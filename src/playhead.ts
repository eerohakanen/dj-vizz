import { approach, clamp, lerp, wrap } from './math';
import { clock, fx, signal } from './state';

const MAX_LOOP_BEATS = 8;
const FREE_SPEED_RATE = 2;
const CALM_SPEED = 0.75;
const ENERGY_SPEED = 1.5;
const GRID_PULL_RATE = 3;
const DOUBLE_TIME_DROP = 0.6;
const DOUBLE_TIME_RELEASE = 0.2;
const HALF_TIME_CALM = 0.7;
const HALF_TIME_RELEASE = 0.3;

export const loopBeatsFor = (loopSeconds: number, bpm: number) =>
  clamp(2 ** Math.round(Math.log2((loopSeconds * bpm) / 60)), 1, MAX_LOOP_BEATS);

export const gridPosition = (phraseBeat: number, beatPhase: number, loopBeats: number) =>
  wrap(phraseBeat + beatPhase, loopBeats) / loopBeats;

const loopDistance = (from: number, to: number) => wrap(to - from + 0.5, 1) - 0.5;

export function stepPlayhead(position: number, rate: number, delta: number, target?: number) {
  const next = position + rate * delta;
  if (target === undefined) return wrap(next, 1);
  return wrap(next + loopDistance(next, target) * Math.min(1, delta * GRID_PULL_RATE), 1);
}

export function tempoScale(current: number, drop: number, calm: number) {
  if (current > 1) return drop < DOUBLE_TIME_RELEASE ? 1 : current;
  if (current < 1) return calm < HALF_TIME_RELEASE ? 1 : current;
  if (drop > DOUBLE_TIME_DROP) return 2;
  if (calm > HALF_TIME_CALM) return 0.5;
  return 1;
}

export function frameAt(position: number, delays: number[]) {
  const total = delays.reduce((sum, delay) => sum + delay, 0);
  let remaining = wrap(position, 1) * total;
  for (let i = 0; i < delays.length; i++) {
    if (remaining < delays[i]) return i;
    remaining -= delays[i];
  }
  return delays.length - 1;
}

export function createPlayhead() {
  let scale = 1;
  let freeSpeed = 1;
  return {
    position: 0,
    restart() {
      this.position = 0;
    },
    advance(loopSeconds: number) {
      const { delta } = clock;
      scale = tempoScale(scale, fx.drop, fx.calm);
      if (signal.bpm > 0) {
        const loopBeats = loopBeatsFor(loopSeconds, signal.bpm) / scale;
        this.position = stepPlayhead(this.position, signal.bpm / 60 / loopBeats, delta, gridPosition(signal.phraseBeat, signal.beatPhase, loopBeats));
      } else {
        freeSpeed = approach(freeSpeed, lerp(CALM_SPEED, ENERGY_SPEED, signal.energy) * scale, FREE_SPEED_RATE, delta);
        this.position = stepPlayhead(this.position, freeSpeed / loopSeconds, delta);
      }
      return this.position;
    },
  };
}
