import { describe, expect, it } from 'vitest';
import { BODIES } from './bodies';
import {
  busy,
  cataclysmPose,
  createCataclysm,
  displace,
  FALLBACK_DROPS,
  ignite,
  IGNITE_TENSION,
  MAX_SHOCK,
  MIN_VISIT_SECONDS,
  PHASE_BARS,
  phaseLevel,
  shockRadius,
  shouldIgnite,
  stepCataclysm,
  UNLOCKED_BAR_SECONDS,
} from './cataclysm';
import { distance, vec } from './shots';

const visited = () => {
  const cataclysm = createCataclysm();
  stepCataclysm(cataclysm, MIN_VISIT_SECONDS, UNLOCKED_BAR_SECONDS);
  return cataclysm;
};

describe('shouldIgnite', () => {
  it('waits for the minimum visit before igniting', () => {
    const cataclysm = createCataclysm();
    expect(shouldIgnite(cataclysm, 1)).toBe(false);
    stepCataclysm(cataclysm, MIN_VISIT_SECONDS, UNLOCKED_BAR_SECONDS);
    expect(shouldIgnite(cataclysm, 1)).toBe(true);
  });

  it('needs a big build-up unless enough plain drops have passed', () => {
    const cataclysm = visited();
    expect(shouldIgnite(cataclysm, IGNITE_TENSION - 0.01)).toBe(false);
    expect(shouldIgnite(cataclysm, IGNITE_TENSION)).toBe(true);
    cataclysm.drops = FALLBACK_DROPS - 1;
    expect(shouldIgnite(cataclysm, 0)).toBe(true);
  });

  it('never re-ignites while running', () => {
    const cataclysm = visited();
    ignite(cataclysm, 0);
    expect(busy(cataclysm)).toBe(true);
    expect(shouldIgnite(cataclysm, 1)).toBe(false);
  });
});

describe('stepCataclysm', () => {
  it('runs each phase for its bar count at the current tempo', () => {
    const cataclysm = visited();
    ignite(cataclysm, 0);
    const barSeconds = 1.5;
    stepCataclysm(cataclysm, PHASE_BARS.supernova * barSeconds - 0.01, barSeconds);
    expect(cataclysm.phase).toBe('supernova');
    stepCataclysm(cataclysm, 0.02, barSeconds);
    expect(cataclysm.phase).toBe('collapse');
    stepCataclysm(cataclysm, PHASE_BARS.collapse * barSeconds, barSeconds);
    expect(cataclysm.phase).toBe('dive');
    stepCataclysm(cataclysm, PHASE_BARS.dive * barSeconds, barSeconds);
    expect(cataclysm.phase).toBe('done');
  });

  it('stays done after finishing a long frame', () => {
    const cataclysm = visited();
    ignite(cataclysm, 0);
    stepCataclysm(cataclysm, 1000, UNLOCKED_BAR_SECONDS);
    expect(cataclysm.phase).toBe('done');
    stepCataclysm(cataclysm, 1, UNLOCKED_BAR_SECONDS);
    expect(cataclysm.phase).toBe('done');
    expect(phaseLevel(cataclysm, 'dive')).toBe(1);
  });
});

describe('cataclysm geometry', () => {
  it('grows the shock from the sun past the outermost planet', () => {
    const cataclysm = visited();
    ignite(cataclysm, 0);
    expect(shockRadius(cataclysm)).toBeCloseTo(BODIES[0].radius);
    stepCataclysm(cataclysm, PHASE_BARS.supernova * UNLOCKED_BAR_SECONDS, UNLOCKED_BAR_SECONDS);
    expect(shockRadius(cataclysm)).toBeCloseTo(MAX_SHOCK);
    expect(MAX_SHOCK).toBeGreaterThan(Math.max(...BODIES.map((body) => body.orbit)));
  });

  it('keeps the camera path continuous across phase changes', () => {
    const cataclysm = visited();
    ignite(cataclysm, 1);
    const step = 0.001;
    let previous = cataclysmPose(cataclysm).position;
    for (let i = 0; i < 16 / step; i++) {
      stepCataclysm(cataclysm, step * UNLOCKED_BAR_SECONDS, UNLOCKED_BAR_SECONDS);
      const { position } = cataclysmPose(cataclysm);
      expect(distance(previous, position)).toBeLessThan(1);
      previous = position;
    }
    expect(cataclysm.phase).toBe('done');
  });

  it('leaves untouched space alone and pulls everything into the hole', () => {
    const point = vec(50, 0, 0);
    expect(displace(point, 10, 0)).toEqual(point);
    expect(displace(point, 90, 0).x).toBeCloseTo(70);
    expect(distance(displace(point, 0, 1), vec(0, 0, 0))).toBeLessThan(2);
  });
});
