import { describe, expect, it } from 'vitest';
import { BELT_CLEARANCE, BODIES, orbitPoint, outerRadius } from './bodies';
import { bezier, distance, eclipse, eclipseCoverage, keepClear, SHOTS, shotsFor, sub, vec, type Vec } from './shots';

const centers = BODIES.map((body) => {
  const { x, z } = orbitPoint(body);
  return vec(x, 0, z);
});

const contextFor = (index: number) => {
  const body = BODIES[index];
  return { body, center: centers[index], parent: body.parent === undefined ? undefined : centers[body.parent] };
};

const samples = Array.from({ length: 240 }, (_, i) => i * 0.5);

function localRing(index: number, point: Vec) {
  const body = BODIES[index];
  const offset = sub(point, centers[index]);
  const cos = Math.cos(-body.tilt);
  const sin = Math.sin(-body.tilt);
  const x = offset.x * cos - offset.y * sin;
  const y = offset.x * sin + offset.y * cos;
  return { height: y, radial: Math.hypot(x, offset.z) / body.radius };
}

function expectClear(index: number, point: Vec) {
  BODIES.forEach((other, j) => {
    if (other.kind === 'belt') return;
    const limit = j === index ? other.radius * 1.05 : outerRadius(other) * 1.05;
    expect(distance(point, centers[j])).toBeGreaterThan(limit);
  });
  const body = BODIES[index];
  if (!body.ring) return;
  const { height, radial } = localRing(index, point);
  const inRing = radial > body.ring.inner && radial < body.ring.outer;
  if (inRing) expect(Math.abs(height)).toBeGreaterThan(body.radius * 0.05);
}

describe('shots', () => {
  BODIES.forEach((body, index) => {
    for (const name of shotsFor(body)) {
      it(`${body.name} ${name} stays clear of every body and ring`, () => {
        for (const t of samples) expectClear(index, SHOTS[name](contextFor(index), t).position);
      });

      it(`${body.name} ${name} moves continuously`, () => {
        for (const t of samples) {
          const step = distance(SHOTS[name](contextFor(index), t).position, SHOTS[name](contextFor(index), t + 1 / 60).position);
          expect(step).toBeLessThan(body.view * 0.05);
        }
      });
    }
  });

  it('keeps the belt flyby inside the asteroid-free pocket', () => {
    const index = BODIES.findIndex((body) => body.kind === 'belt');
    for (const t of samples) expect(distance(SHOTS.flyby(contextFor(index), t).position, centers[index])).toBeLessThan(BELT_CLEARANCE * 0.95);
  });

  it('gives Saturn ring shots and the Moon an Earthrise', () => {
    expect(shotsFor(BODIES.find((body) => body.name === 'Saturn')!)).toEqual(expect.arrayContaining(['ringOrbit', 'ringDive']));
    expect(shotsFor(BODIES.find((body) => body.name === 'Moon')!)[0]).toBe('earthrise');
  });
});

describe('eclipse', () => {
  const eclipsable = BODIES.map((body, index) => ({ body, index })).filter(({ body }) => body.kind === 'planet' || body.kind === 'moon');

  eclipsable.forEach(({ body, index }) => {
    it(`${body.name} fully covers the Sun at mid-sweep and clears it at the ends`, () => {
      const middle = eclipse(contextFor(index), 0.5).position;
      expect(eclipseCoverage(middle, centers[index], body.radius)).toBe(1);
      expect(eclipseCoverage(eclipse(contextFor(index), 0).position, centers[index], body.radius)).toBe(0);
      expect(eclipseCoverage(eclipse(contextFor(index), 1).position, centers[index], body.radius)).toBe(0);
    });

    it(`${body.name} eclipse path stays clear of every body`, () => {
      for (let p = 0; p <= 1; p += 0.05) expectClear(index, eclipse(contextFor(index), p).position);
    });
  });

  it('reports no coverage when the body is behind the Sun', () => {
    expect(eclipseCoverage(vec(-50, 0, 0), vec(20, 0, 0), 1)).toBe(0);
  });
});

describe('travel helpers', () => {
  it('hits both endpoints of the curve', () => {
    const [a, b, c, d] = [vec(0, 0, 0), vec(1, 2, 0), vec(3, 2, 0), vec(4, 0, 0)];
    expect(bezier(a, b, c, d, 0)).toEqual(a);
    expect(bezier(a, b, c, d, 1)).toEqual(d);
  });

  it('pushes points out of the Sun but leaves open space alone', () => {
    const pushed = keepClear(vec(1, 0, 0), centers, []);
    expect(distance(pushed, centers[0])).toBeGreaterThan(BODIES[0].radius);
    expect(keepClear(vec(0, 200, 0), centers, [])).toEqual(vec(0, 200, 0));
  });
});
