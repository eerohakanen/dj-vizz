import { describe, expect, it } from 'vitest';
import { createDropState, type DropFrame, type DropState, stepDrop } from './drop';

const FRAME = 1 / 60;
const BEAT = 0.5;
const DB = 1 / 70;
const PEAK = 0.97;
const FULL = 0.75;

interface Section {
  beats: number;
  peak?: number;
  sustain?: number;
  kicks?: boolean;
  full?: number;
  tension?: number;
  locked?: boolean;
}

function play(state: DropState, sections: Section[], sensitivity = 1) {
  const drops: number[] = [];
  let time = 0;
  let beat = 0;
  for (const { beats, peak = PEAK, sustain = peak - 8 * DB, kicks = true, full = FULL, tension = 0, locked = true } of sections) {
    for (let index = 0; index < beats; index++, beat++) {
      const beatStart = beat * BEAT;
      let first = true;
      while (time < beatStart + BEAT - 1e-9) {
        const onKick = kicks && first;
        const frame: DropFrame = {
          time,
          delta: FRAME,
          kick: onKick ? 0.8 : 0,
          kickLevel: kicks && time - beatStart < 0.1 ? peak : sustain,
          fullLevel: full,
          tension,
          period: locked ? BEAT : 0,
          locked,
          phraseBeat: beat % 32,
          beatInBar: beat % 4,
        };
        if (stepDrop(state, frame, sensitivity)) drops.push(beat);
        first = false;
        time += FRAME;
      }
    }
  }
  return drops;
}

const groove = (beats: number, extra: Partial<Section> = {}): Section => ({ beats, ...extra });
const breakdown = (beats: number, extra: Partial<Section> = {}): Section => ({
  beats,
  kicks: false,
  sustain: PEAK - 15 * DB,
  full: FULL - 8 * DB,
  ...extra,
});

describe('stepDrop', () => {
  it('never fires on a steady groove', () => {
    expect(play(createDropState(), [groove(128)])).toEqual([]);
  });

  it('fires on the first kick after a breakdown that only falls 15 dB', () => {
    expect(play(createDropState(), [groove(32), breakdown(32), groove(16)])).toEqual([64]);
  });

  it('fires when the next track in the mix is 6 dB quieter', () => {
    const quieter = PEAK - 6 * DB;
    expect(play(createDropState(), [groove(32), breakdown(32), groove(16, { peak: quieter })])).toEqual([64]);
  });

  it('ignores a new track layered over a running groove', () => {
    expect(play(createDropState(), [groove(32), groove(32, { peak: 1, full: FULL + 4 * DB })])).toEqual([]);
  });

  it('fires without a tempo lock', () => {
    const unlocked = { locked: false };
    expect(play(createDropState(), [groove(32, unlocked), breakdown(32, unlocked), groove(16, unlocked)])).toEqual([64]);
  });

  it('fires within a beat when the sub enters after the first kick', () => {
    const thinKick = groove(1, { peak: PEAK - 10 * DB, sustain: PEAK - 15 * DB });
    const drops = play(createDropState(), [groove(32), breakdown(31), thinKick, groove(16)]);
    expect(drops).toHaveLength(1);
    expect(drops[0]).toBeGreaterThanOrEqual(63);
    expect(drops[0]).toBeLessThanOrEqual(64);
  });

  it('ignores a single missing kick', () => {
    expect(play(createDropState(), [groove(32), breakdown(1), groove(32)])).toEqual([]);
  });

  it('does not fire when the music starts after silence', () => {
    expect(play(createDropState(), [breakdown(16, { sustain: 0, full: 0 }), groove(32)])).toEqual([]);
  });

  it('never fires when sensitivity is off', () => {
    expect(play(createDropState(), [groove(32), breakdown(32), groove(16)], 0)).toEqual([]);
  });

  it('waits out the cooldown before a second drop', () => {
    expect(play(createDropState(), [groove(32), breakdown(16), groove(2), breakdown(6), groove(16)])).toEqual([48]);
  });

  it('fires again once the cooldown has passed', () => {
    expect(play(createDropState(), [groove(32), breakdown(16), groove(20), breakdown(8), groove(16)])).toEqual([48, 76]);
  });
});
