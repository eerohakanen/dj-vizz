import { describe, expect, it } from 'vitest';
import { anchorPhraseVotes, createPhraseState, type PhraseFrame, type PhraseState, phraseAlignment, phraseStrength, stepPhrase } from './phrase';

const FRAMES_PER_BAR = 120;

interface Bar {
  bass: number;
  mid: number;
  high: number;
  kicks: number;
  snares: number;
  hats: number;
  tension?: number;
}

const GROOVE: Bar = { bass: 0.7, mid: 0.4, high: 0.3, kicks: 4, snares: 2, hats: 8 };
const BREAK: Bar = { bass: 0.1, mid: 0.35, high: 0.2, kicks: 0, snares: 0, hats: 0 };
const PEAK: Bar = { bass: 0.8, mid: 0.6, high: 0.6, kicks: 4, snares: 2, hats: 16 };
const FILL: Bar = { ...GROOVE, kicks: 2, snares: 8, tension: 0.6 };

const repeat = (bar: Bar, count: number) => Array.from({ length: count }, () => bar);

const hitAt = (frame: number, count: number) => count > 0 && frame % Math.floor(FRAMES_PER_BAR / count) === 0;

function play(state: PhraseState, bars: Bar[], startBar = 0) {
  let gridBar = startBar;
  const shifts: number[] = [];
  const phraseStarts: number[] = [];
  bars.forEach((bar, index) => {
    for (let frame = 0; frame < FRAMES_PER_BAR; frame++) {
      const downbeat = frame === 0;
      const input: PhraseFrame = {
        locked: true,
        downbeat,
        barInPhrase: gridBar % 8,
        bass: bar.bass,
        mid: bar.mid,
        high: bar.high,
        brightness: bar.high,
        vocal: 0,
        kick: hitAt(frame, bar.kicks) ? 1 : 0,
        snare: hitAt(frame, bar.snares) ? 1 : 0,
        hat: hitAt(frame, bar.hats) ? 1 : 0,
        tension: bar.tension ?? 0,
      };
      const shift = stepPhrase(state, input);
      if (shift) {
        gridBar = (gridBar - shift + 8) % 8;
        shifts.push(index);
      }
      if (downbeat && gridBar % 8 === 0) phraseStarts.push(index);
    }
    gridBar++;
  });
  return { shifts, phraseStarts };
}

describe('stepPhrase', () => {
  it('keeps the grid on a steady loop', () => {
    const state = createPhraseState();
    expect(play(state, repeat(GROOVE, 64)).shifts).toEqual([]);
  });

  it('keeps the grid when sections change on phrase boundaries', () => {
    const state = createPhraseState();
    const track = [...repeat(GROOVE, 16), ...repeat(BREAK, 8), ...repeat(PEAK, 16)];
    expect(play(state, track).shifts).toEqual([]);
    expect(phraseAlignment(state)).toBeGreaterThan(0.6);
  });

  it('moves the grid onto sections that start off the grid', () => {
    const state = createPhraseState();
    const track = [...repeat(GROOVE, 11), ...repeat(BREAK, 8), ...repeat(GROOVE, 8), ...repeat(PEAK, 8), ...repeat(GROOVE, 8)];
    const { shifts, phraseStarts } = play(state, track);
    expect(shifts.length).toBeGreaterThan(0);
    expect(phraseStarts).toContain(27);
    expect(phraseStarts).toContain(35);
  });

  it('ignores a single fill bar', () => {
    const state = createPhraseState();
    const track = [...repeat(GROOVE, 13), FILL, ...repeat(GROOVE, 18)];
    expect(play(state, track).shifts).toEqual([]);
  });

  it('ignores a fill that closes every phrase', () => {
    const state = createPhraseState();
    const phrase = [...repeat(GROOVE, 7), FILL];
    expect(play(state, Array.from({ length: 8 }, () => phrase).flat()).shifts).toEqual([]);
  });

  it('holds an anchored grid against one off-grid change', () => {
    const state = createPhraseState();
    play(state, repeat(GROOVE, 8));
    anchorPhraseVotes(state);
    const track = [...repeat(GROOVE, 11), ...repeat(PEAK, 13)];
    expect(play(state, track).shifts).toEqual([]);
  });

  it('rates a phrase start after a fill stronger than a plain one', () => {
    const plain = createPhraseState();
    play(plain, [...repeat(GROOVE, 16), ...repeat(PEAK, 8), ...repeat(GROOVE, 8)]);
    const filled = createPhraseState();
    play(filled, [...repeat(GROOVE, 16), ...repeat(PEAK, 8), ...repeat(GROOVE, 7), FILL, GROOVE]);
    expect(phraseStrength(filled)).toBeGreaterThan(phraseStrength(plain));
  });
});
