import { describe, expect, it } from 'vitest';
import { BODIES, compressOrbit, compressRadius, orbitPoint, outerRadius } from './bodies';

const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe('bodies', () => {
  it('keeps the real size and distance ordering after compression', () => {
    expect(compressRadius(69_911)).toBeGreaterThan(compressRadius(6371));
    expect(compressOrbit(30.1)).toBeGreaterThan(compressOrbit(19.2));
  });

  it('orders heliocentric stops outward from the Sun', () => {
    const orbits = BODIES.filter((body) => body.parent === undefined).map((body) => body.orbit);
    expect(orbits).toEqual([...orbits].sort((a, b) => a - b));
  });

  it('never lets a body or its rings reach a neighbour', () => {
    const points = BODIES.map(orbitPoint);
    BODIES.forEach((body, i) =>
      BODIES.forEach((other, j) => {
        if (i < j) expect(distance(points[i], points[j])).toBeGreaterThan(outerRadius(body) + outerRadius(other));
      }),
    );
  });

  it('parks the camera outside the body but closer than any neighbour', () => {
    const points = BODIES.map(orbitPoint);
    BODIES.forEach((body, i) => {
      expect(body.view).toBeGreaterThan(outerRadius(body));
      BODIES.forEach((other, j) => {
        if (i !== j) expect(distance(points[i], points[j]) - outerRadius(other)).toBeGreaterThan(body.view);
      });
    });
  });

  it('places the Moon relative to Earth', () => {
    const moon = BODIES.find((body) => body.name === 'Moon')!;
    const earth = BODIES[moon.parent!];
    expect(distance(orbitPoint(moon), orbitPoint(earth))).toBeCloseTo(moon.orbit);
  });
});
