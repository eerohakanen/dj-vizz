import { describe, expect, it } from 'vitest';
import {
  BARS_PER_SHOT,
  CALM_BARS_PER_SHOT,
  createTour,
  eclipseProgress,
  eclipsing,
  MIN_DWELL_SECONDS,
  nextStop,
  PHRASE_CUT_BARS,
  PHRASES_PER_STOP,
  stepTour,
  type Tour,
  type TourInput,
  traveling,
  UNLOCKED_DWELL_SECONDS,
  UNLOCKED_SHOT_SECONDS,
  warpLevel,
} from './tour';

const STOPS = [0, 1, 2, 3];
const SHOTS = 3;

const input = (overrides: Partial<TourInput> = {}): TourInput => ({
  delta: 0.1,
  drop: false,
  phraseEnded: false,
  strongPhrase: false,
  downbeat: false,
  calm: 0,
  tempoLocked: true,
  cruiseSeconds: 5,
  random: 0,
  eclipseSeconds: 8,
  canEclipse: false,
  shotCount: SHOTS,
  ...overrides,
});

const step = (tour: Tour, overrides: Partial<TourInput> = {}) => stepTour(tour, input(overrides), STOPS);

function arrive(tour: Tour) {
  while (traveling(tour)) step(tour);
}

describe('stepTour departures', () => {
  it('starts parked at the first stop on the first shot', () => {
    const tour = createTour();
    expect(traveling(tour)).toBe(false);
    expect([tour.to, tour.shot]).toEqual([0, 0]);
  });

  it('cruises on a drop once the minimum dwell has passed', () => {
    const tour = createTour();
    step(tour, { delta: MIN_DWELL_SECONDS / 2, drop: true });
    expect(traveling(tour)).toBe(false);
    step(tour, { delta: MIN_DWELL_SECONDS, drop: true });
    expect(traveling(tour)).toBe(true);
    expect(tour.travelSeconds).toBe(5);
    expect([tour.from, tour.to]).toEqual([0, 1]);
  });

  it('cruises after the phrase count when tempo is locked', () => {
    const tour = createTour();
    step(tour, { delta: MIN_DWELL_SECONDS });
    for (let i = 1; i < PHRASES_PER_STOP; i++) step(tour, { phraseEnded: true });
    expect(traveling(tour)).toBe(false);
    step(tour, { phraseEnded: true });
    expect(traveling(tour)).toBe(true);
    expect(tour.travelSeconds).toBe(5);
  });

  it('cruises after a single strong phrase', () => {
    const tour = createTour();
    step(tour, { delta: MIN_DWELL_SECONDS });
    step(tour, { phraseEnded: true, strongPhrase: true });
    expect(traveling(tour)).toBe(true);
  });

  it('lingers through calm sections but still leaves on a drop', () => {
    const tour = createTour();
    step(tour, { delta: MIN_DWELL_SECONDS });
    for (let i = 0; i < PHRASES_PER_STOP * 3; i++) step(tour, { phraseEnded: true, calm: 1 });
    expect(traveling(tour)).toBe(false);
    step(tour, { calm: 1, drop: true });
    expect(traveling(tour)).toBe(true);
  });

  it('falls back to a timed dwell without a tempo lock', () => {
    const tour = createTour();
    step(tour, { delta: UNLOCKED_DWELL_SECONDS - 1, tempoLocked: false });
    expect(traveling(tour)).toBe(false);
    step(tour, { delta: 1, tempoLocked: false });
    expect(traveling(tour)).toBe(true);
  });

  it('peaks warp midway and resets the stop state on departure', () => {
    const tour = createTour();
    step(tour, { delta: MIN_DWELL_SECONDS, drop: true });
    expect([tour.shot, tour.dwell, tour.phrases, tour.eclipsed]).toEqual([0, 0, 0, false]);
    step(tour, { delta: 2.5 });
    expect(warpLevel(tour)).toBeCloseTo(1);
    step(tour, { delta: 2.5 });
    expect(traveling(tour)).toBe(false);
  });

  it('ignores drops while travelling', () => {
    const tour = createTour();
    step(tour, { delta: MIN_DWELL_SECONDS, drop: true });
    step(tour, { drop: true, random: 0.9 });
    expect([tour.from, tour.to, tour.leg]).toEqual([0, 1, 1]);
    arrive(tour);
    expect(traveling(tour)).toBe(false);
  });

  it('picks a random stop other than the current one', () => {
    expect(nextStop(0, STOPS, 0)).toBe(1);
    expect(nextStop(2, STOPS, 0.5)).toBe(1);
    expect(nextStop(1, STOPS, 0.5)).toBe(2);
    expect(nextStop(3, STOPS, 0.9999)).toBe(2);
    expect(nextStop(0, STOPS, 1)).toBe(3);
    for (const current of STOPS) {
      const reached = new Set(Array.from({ length: 30 }, (_, i) => nextStop(current, STOPS, i / 30)));
      expect([...reached].sort()).toEqual(STOPS.filter((stop) => stop !== current));
    }
  });

  it('only visits the listed stops', () => {
    expect(nextStop(0, [0, 2, 5], 0)).toBe(2);
    expect(nextStop(0, [0, 2, 5], 0.99)).toBe(5);
  });
});

describe('stepTour shots', () => {
  it('cuts only on the downbeat that completes the bar count', () => {
    const tour = createTour();
    for (let i = 0; i < 50; i++) step(tour);
    expect(tour.shot).toBe(0);
    for (let i = 1; i < BARS_PER_SHOT; i++) step(tour, { downbeat: true });
    expect(tour.shot).toBe(0);
    step(tour, { downbeat: true });
    expect(tour.shot).toBe(1);
  });

  it('holds shots twice as long when calm', () => {
    const tour = createTour();
    for (let i = 0; i < BARS_PER_SHOT; i++) step(tour, { downbeat: true, calm: 1 });
    expect(tour.shot).toBe(0);
    for (let i = BARS_PER_SHOT; i < CALM_BARS_PER_SHOT; i++) step(tour, { downbeat: true, calm: 1 });
    expect(tour.shot).toBe(1);
  });

  it('cycles through the shot list', () => {
    const tour = createTour();
    for (let i = 0; i < BARS_PER_SHOT * SHOTS; i++) step(tour, { downbeat: true });
    expect(tour.shot).toBe(0);
    expect(tour.cuts).toBe(SHOTS);
  });

  it('cuts on a phrase start once the shot is near its bar count', () => {
    const tour = createTour();
    for (let i = 2; i < BARS_PER_SHOT - PHRASE_CUT_BARS; i++) step(tour, { downbeat: true });
    step(tour, { downbeat: true, phraseEnded: true });
    expect(tour.shot).toBe(0);
    step(tour, { downbeat: true, phraseEnded: true });
    expect([tour.shot, tour.bars]).toEqual([1, 0]);
  });

  it('cuts once when the phrase start and the bar count coincide', () => {
    const tour = createTour();
    for (let i = 1; i < BARS_PER_SHOT; i++) step(tour, { downbeat: true });
    step(tour, { downbeat: true, phraseEnded: true });
    expect([tour.shot, tour.cuts]).toEqual([1, 1]);
    step(tour);
    expect([tour.shot, tour.cuts]).toEqual([1, 1]);
  });

  it('holds calm shots across a phrase start that comes too early', () => {
    const tour = createTour();
    for (let i = 0; i < BARS_PER_SHOT; i++) step(tour, { downbeat: true, calm: 1, phraseEnded: i === BARS_PER_SHOT - 1 });
    expect(tour.shot).toBe(0);
    for (let i = BARS_PER_SHOT; i < CALM_BARS_PER_SHOT - PHRASE_CUT_BARS; i++) step(tour, { downbeat: true, calm: 1 });
    step(tour, { calm: 1, phraseEnded: true });
    expect(tour.shot).toBe(1);
  });

  it('cuts on a timer without a tempo lock', () => {
    const tour = createTour();
    step(tour, { delta: UNLOCKED_SHOT_SECONDS - 0.5, tempoLocked: false });
    expect(tour.shot).toBe(0);
    step(tour, { delta: 0.5, tempoLocked: false });
    expect(tour.shot).toBe(1);
  });
});

describe('stepTour eclipses', () => {
  it('turns the first drop at an eclipsable stop into an eclipse, then leaves on the next', () => {
    const tour = createTour();
    step(tour, { drop: true, canEclipse: true });
    expect(eclipsing(tour)).toBe(true);
    expect(traveling(tour)).toBe(false);
    step(tour, { delta: 4 });
    expect(eclipseProgress(tour)).toBeCloseTo(0.5, 1);
    step(tour, { delta: 4 });
    expect(eclipsing(tour)).toBe(false);
    expect(tour.shot).toBe(1);
    step(tour, { drop: true, canEclipse: true });
    expect(traveling(tour)).toBe(true);
  });

  it('ignores drops, phrases and downbeats during an eclipse', () => {
    const tour = createTour();
    step(tour, { delta: MIN_DWELL_SECONDS, drop: true, canEclipse: true });
    for (let i = 0; i < 10; i++) step(tour, { drop: true, phraseEnded: true, downbeat: true, canEclipse: true });
    expect(eclipsing(tour)).toBe(true);
    expect(traveling(tour)).toBe(false);
    expect(tour.phrases).toBe(0);
  });

  it('leaves straight away at stops that cannot eclipse', () => {
    const tour = createTour();
    step(tour, { delta: MIN_DWELL_SECONDS, drop: true });
    expect(eclipsing(tour)).toBe(false);
    expect(traveling(tour)).toBe(true);
  });
});
