import { clamp01, smoothstep } from '../../math';

export const MIN_DWELL_SECONDS = 6;
export const PHRASES_PER_STOP = 2;
export const UNLOCKED_DWELL_SECONDS = 24;
export const CALM_HOLD = 0.5;
export const BARS_PER_SHOT = 4;
export const CALM_BARS_PER_SHOT = 8;
export const UNLOCKED_SHOT_SECONDS = 10;

export interface Tour {
  from: number;
  to: number;
  travel: number;
  travelSeconds: number;
  jumping: boolean;
  leg: number;
  cuts: number;
  dwell: number;
  phrases: number;
  shot: number;
  bars: number;
  shotSeconds: number;
  eclipse: number;
  eclipseSeconds: number;
  eclipsed: boolean;
}

export interface TourInput {
  delta: number;
  drop: boolean;
  phraseEnded: boolean;
  downbeat: boolean;
  calm: number;
  tempoLocked: boolean;
  cruiseSeconds: number;
  jumpSeconds: number;
  eclipseSeconds: number;
  canEclipse: boolean;
  shotCount: number;
}

export const createTour = (): Tour => ({
  from: 0,
  to: 0,
  travel: 1,
  travelSeconds: 1,
  jumping: false,
  leg: 0,
  cuts: 0,
  dwell: 0,
  phrases: 0,
  shot: 0,
  bars: 0,
  shotSeconds: 0,
  eclipse: -1,
  eclipseSeconds: 1,
  eclipsed: false,
});

export const traveling = (tour: Tour) => tour.travel < 1;

export const eclipsing = (tour: Tour) => tour.eclipse >= 0;

export const eclipseProgress = (tour: Tour) => clamp01(tour.eclipse / tour.eclipseSeconds);

export const warpLevel = (tour: Tour) => Math.sin(Math.PI * tour.travel);

export const lookEase = (tour: Tour) => smoothstep(clamp01((tour.travel - 0.05) / 0.5));

function readyToLeave(tour: Tour, input: TourInput) {
  if (tour.dwell < MIN_DWELL_SECONDS || input.calm > CALM_HOLD) return false;
  return input.tempoLocked ? tour.phrases >= PHRASES_PER_STOP : tour.dwell >= UNLOCKED_DWELL_SECONDS;
}

function cut(tour: Tour, shotCount: number) {
  tour.shot = (tour.shot + 1) % shotCount;
  tour.bars = 0;
  tour.shotSeconds = 0;
  tour.cuts++;
}

function depart(tour: Tour, stopCount: number, jumping: boolean, seconds: number) {
  Object.assign(tour, {
    from: tour.to,
    to: (tour.to + 1) % stopCount,
    travel: 0,
    travelSeconds: seconds,
    jumping,
    leg: tour.leg + 1,
    cuts: tour.cuts + 1,
    dwell: 0,
    phrases: 0,
    shot: 0,
    bars: 0,
    shotSeconds: 0,
    eclipse: -1,
    eclipsed: false,
  });
}

function advanceShot(tour: Tour, input: TourInput) {
  tour.shotSeconds += input.delta;
  if (!input.tempoLocked) {
    if (tour.shotSeconds >= UNLOCKED_SHOT_SECONDS) cut(tour, input.shotCount);
    return;
  }
  if (input.downbeat) tour.bars++;
  if (tour.bars >= (input.calm > CALM_HOLD ? CALM_BARS_PER_SHOT : BARS_PER_SHOT)) cut(tour, input.shotCount);
}

export function stepTour(tour: Tour, input: TourInput, stopCount: number) {
  if (traveling(tour)) {
    tour.travel = Math.min(1, tour.travel + input.delta / tour.travelSeconds);
    return;
  }
  tour.dwell += input.delta;
  if (eclipsing(tour)) {
    tour.eclipse += input.delta;
    if (tour.eclipse < tour.eclipseSeconds) return;
    tour.eclipse = -1;
    cut(tour, input.shotCount);
    return;
  }
  if (input.phraseEnded) tour.phrases++;
  if (input.drop && input.canEclipse && !tour.eclipsed) {
    Object.assign(tour, { eclipse: 0, eclipseSeconds: input.eclipseSeconds, eclipsed: true, cuts: tour.cuts + 1 });
    return;
  }
  if (input.drop && tour.dwell >= MIN_DWELL_SECONDS) return depart(tour, stopCount, true, input.jumpSeconds);
  if (readyToLeave(tour, input)) return depart(tour, stopCount, false, input.cruiseSeconds);
  advanceShot(tour, input);
}
