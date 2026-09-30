export type BodyKind = 'star' | 'planet' | 'moon' | 'belt';

export interface Body {
  name: string;
  kind: BodyKind;
  radius: number;
  orbit: number;
  angle: number;
  tilt: number;
  spin: number;
  view: number;
  color: string;
  texture?: string;
  clouds?: string;
  ring?: { inner: number; outer: number; texture: string };
  rim?: string;
  signature?: 'swirl' | 'aurora';
  parent?: number;
}

const RADIUS_SCALE = 0.25;
const ORBIT_SCALE = 30;
const ORBIT_OFFSET = 12;
const KM_PER_UNIT = 1000;
const VIEW_RATIO = 4;

export const compressRadius = (km: number) => RADIUS_SCALE * Math.sqrt(km / KM_PER_UNIT);

export const compressOrbit = (au: number) => ORBIT_OFFSET + ORBIT_SCALE * Math.sqrt(au);

interface PlanetSpec {
  name: string;
  km: number;
  au: number;
  angle: number;
  tilt: number;
  spin: number;
  color: string;
  texture: string;
  clouds?: string;
  ring?: { inner: number; outer: number; texture: string };
  rim?: string;
  signature?: 'swirl' | 'aurora';
}

const planet = ({ km, au, ...spec }: PlanetSpec): Body => {
  const radius = compressRadius(km);
  return { ...spec, kind: 'planet', radius, orbit: compressOrbit(au), view: radius * VIEW_RATIO };
};

const SUN_RADIUS = compressRadius(696_000);
const EARTH = 3;
export const BELT_ORBIT = compressOrbit(2.7);
export const BELT_ANGLE = 0.95;
export const BELT_CLEARANCE = 4.5;

export const BODIES: Body[] = [
  {
    name: 'Sun',
    kind: 'star',
    radius: SUN_RADIUS,
    orbit: 0,
    angle: 0,
    tilt: 0.12,
    spin: 0.02,
    view: SUN_RADIUS * 3.2,
    color: '#ffb347',
    texture: '2k_sun.jpg',
  },
  planet({ name: 'Mercury', km: 2440, au: 0.39, angle: 0.1, tilt: 0.001, spin: 0.05, color: '#9a8f86', texture: '2k_mercury.jpg' }),
  planet({ name: 'Venus', km: 6052, au: 0.72, angle: 0.35, tilt: 3.1, spin: -0.02, color: '#e6c37a', texture: '2k_venus_atmosphere.jpg', rim: '#ffd9a0' }),
  planet({
    name: 'Earth',
    km: 6371,
    au: 1,
    angle: 0.6,
    tilt: 0.41,
    spin: 0.12,
    color: '#3a6fb0',
    texture: '2k_earth_daymap.jpg',
    clouds: '2k_earth_clouds.jpg',
    rim: '#6fb4ff',
    signature: 'aurora',
  }),
  {
    name: 'Moon',
    kind: 'moon',
    radius: compressRadius(1737),
    orbit: 3.2,
    angle: 2.2,
    tilt: 0.12,
    spin: 0.03,
    view: compressRadius(1737) * VIEW_RATIO,
    color: '#b5b1aa',
    texture: '2k_moon.jpg',
    parent: EARTH,
  },
  planet({ name: 'Mars', km: 3390, au: 1.52, angle: 0.78, tilt: 0.44, spin: 0.11, color: '#c1440e', texture: '2k_mars.jpg', rim: '#ffb08a' }),
  {
    name: 'Asteroid Belt',
    kind: 'belt',
    radius: 0.4,
    orbit: BELT_ORBIT,
    angle: BELT_ANGLE,
    tilt: 0,
    spin: 0,
    view: 3,
    color: '#7d6f63',
  },
  planet({ name: 'Jupiter', km: 69_911, au: 5.2, angle: 1.1, tilt: 0.05, spin: 0.3, color: '#c9a27c', texture: '2k_jupiter.jpg', rim: '#f2d6b0', signature: 'swirl' }),
  planet({
    name: 'Saturn',
    km: 58_232,
    au: 9.58,
    angle: 1.3,
    tilt: 0.47,
    spin: 0.28,
    color: '#dcc58f',
    texture: '2k_saturn.jpg',
    ring: { inner: 1.24, outer: 2.27, texture: '2k_saturn_ring_alpha.png' },
  }),
  planet({ name: 'Uranus', km: 25_362, au: 19.2, angle: 1.5, tilt: 1.71, spin: -0.18, color: '#9fd8e0', texture: '2k_uranus.jpg', rim: '#c8f4ff' }),
  planet({ name: 'Neptune', km: 24_622, au: 30.1, angle: 1.7, tilt: 0.49, spin: 0.19, color: '#3d5ec9', texture: '2k_neptune.jpg', rim: '#8fb0ff' }),
];

export const SKY_TEXTURE = '2k_stars_milky_way.jpg';

export function orbitPoint(body: Body): { x: number; z: number } {
  const origin = body.parent === undefined ? { x: 0, z: 0 } : orbitPoint(BODIES[body.parent]);
  return { x: origin.x + Math.cos(body.angle) * body.orbit, z: origin.z - Math.sin(body.angle) * body.orbit };
}

export const outerRadius = (body: Body) => body.radius * (body.ring?.outer ?? 1);
