import { clamp01, smoothstep } from '../../math';
import { BODIES, type Body, outerRadius } from './bodies';

export interface Vec {
  x: number;
  y: number;
  z: number;
}

export interface Pose {
  position: Vec;
  look: Vec;
}

export interface ShotContext {
  body: Body;
  center: Vec;
  parent?: Vec;
}

export type ShotName = 'flyby' | 'skim' | 'terminator' | 'silhouette' | 'ringOrbit' | 'ringDive' | 'earthrise' | 'vista' | 'overview';

const ORIGIN: Vec = { x: 0, y: 0, z: 0 };
export const UP: Vec = { x: 0, y: 1, z: 0 };
const ECLIPSE_OVERSIZE = 1.1;
const ECLIPSE_SWEEP = 3;
const ENDPOINT_SAFE_SCALE = 1.1;
const TRAVEL_SAFE_SCALE = 1.15;
const SYSTEM_RADIUS = Math.max(...BODIES.map((body) => body.orbit));
const OVERVIEW_REACH = 1.15;
const OVERVIEW_HEIGHT = 0.6;

export const vec = (x: number, y: number, z: number): Vec => ({ x, y, z });
export const add = (a: Vec, b: Vec, scale = 1) => vec(a.x + b.x * scale, a.y + b.y * scale, a.z + b.z * scale);
export const sub = (a: Vec, b: Vec) => add(a, b, -1);
export const scale = (a: Vec, factor: number) => vec(a.x * factor, a.y * factor, a.z * factor);
export const length = (a: Vec) => Math.hypot(a.x, a.y, a.z);
export const distance = (a: Vec, b: Vec) => length(sub(a, b));
export const normalize = (a: Vec) => scale(a, 1 / (length(a) || 1));
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec, b: Vec) => vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const combine = (origin: Vec, ...terms: [Vec, number][]) => terms.reduce((sum, [axis, amount]) => add(sum, axis, amount), origin);

function frame({ center }: ShotContext) {
  const toSun = length(center) > 0 ? normalize(vec(-center.x, 0, -center.z)) : vec(1, 0, 0);
  return { toSun, side: normalize(cross(UP, toSun)) };
}

function tilted(body: Body, local: Vec, center: Vec) {
  const cos = Math.cos(body.tilt);
  const sin = Math.sin(body.tilt);
  return add(center, vec(local.x * cos - local.y * sin, local.x * sin + local.y * cos, local.z));
}

function flyby(context: ShotContext, t: number): Pose {
  const { body, center } = context;
  const { toSun, side } = frame(context);
  const angle = 0.5 + t * 0.35;
  const radius = body.view * (1 + 0.28 * Math.sin(t * 0.5));
  const position = combine(center, [toSun, Math.cos(angle) * radius], [side, Math.sin(angle) * radius], [UP, body.view * 0.3 * Math.sin(t * 0.27)]);
  return { position, look: center };
}

function skim(context: ShotContext, t: number): Pose {
  const { body, center } = context;
  const { toSun, side } = frame(context);
  const across = normalize(add(toSun, side, 0.6));
  const onCircle = (angle: number, radius: number) => combine(center, [across, Math.cos(angle) * radius], [UP, Math.sin(angle) * radius]);
  const angle = -0.3 + t * 0.3;
  return { position: onCircle(angle, body.radius * 1.3), look: onCircle(angle + 0.45, body.radius) };
}

function terminator(context: ShotContext, t: number): Pose {
  const { body, center } = context;
  const { toSun, side } = frame(context);
  const angle = t * 0.25;
  const radius = body.view * 0.8;
  return { position: combine(center, [side, Math.cos(angle) * radius], [UP, Math.sin(angle) * radius], [toSun, radius * 0.15]), look: center };
}

function silhouette(context: ShotContext, t: number): Pose {
  const { body, center } = context;
  const { toSun, side } = frame(context);
  return { position: combine(center, [toSun, -body.view * 1.1], [side, body.view * 0.6 * Math.cos(t * 0.15)], [UP, body.view * 0.25]), look: center };
}

function ringOrbit({ body, center }: ShotContext, t: number): Pose {
  const angle = t * 0.22;
  const radius = body.radius * 1.75;
  const height = body.radius * (0.1 + 0.04 * Math.sin(t * 0.7));
  const ahead = angle + 0.5;
  return {
    position: tilted(body, vec(Math.cos(angle) * radius, height, Math.sin(angle) * radius), center),
    look: tilted(body, vec(Math.cos(ahead) * radius * 0.85, 0, Math.sin(ahead) * radius * 0.85), center),
  };
}

function ringDive({ body, center }: ShotContext, t: number): Pose {
  const angle = 0.6 + t * 0.05;
  const radius = body.radius * 1.12;
  const ahead = angle + 0.4;
  return {
    position: tilted(body, vec(Math.cos(angle) * radius, body.radius * 0.9 * Math.cos(t * 0.25), Math.sin(angle) * radius), center),
    look: tilted(body, vec(Math.cos(ahead) * radius * 1.6, 0, Math.sin(ahead) * radius * 1.6), center),
  };
}

function earthrise({ body, center, parent }: ShotContext, t: number): Pose {
  const toParent = normalize(sub(parent ?? ORIGIN, center));
  const lift = normalize(sub(UP, scale(toParent, dot(UP, toParent))));
  const angle = 1.45 - 0.3 * smoothstep(clamp01(t / 20));
  const normal = combine(ORIGIN, [toParent, Math.cos(angle)], [lift, Math.sin(angle)]);
  return { position: add(center, normal, body.radius * 1.08), look: parent ?? ORIGIN };
}

function vista(context: ShotContext, t: number): Pose {
  const { body, center } = context;
  const { toSun, side } = frame(context);
  const reach = body.view * 2.2;
  const position = combine(center, [toSun, -reach], [UP, body.view * (0.9 + 0.15 * Math.sin(t * 0.2))], [side, body.view * 0.8 * Math.sin(t * 0.12)]);
  return { position, look: add(center, sub(ORIGIN, center), 0.25) };
}

function overview({ center }: ShotContext, t: number): Pose {
  const angle = Math.atan2(center.z, center.x) + 0.4 + t * 0.03;
  const radius = SYSTEM_RADIUS * OVERVIEW_REACH;
  const height = SYSTEM_RADIUS * OVERVIEW_HEIGHT * (1 + 0.15 * Math.sin(t * 0.07));
  return { position: vec(Math.cos(angle) * radius, height, Math.sin(angle) * radius), look: vec(0, -SYSTEM_RADIUS * 0.1, 0) };
}

export const SHOTS: Record<ShotName, (context: ShotContext, t: number) => Pose> = {
  flyby,
  skim,
  terminator,
  silhouette,
  ringOrbit,
  ringDive,
  earthrise,
  vista,
  overview,
};

export function shotsFor(body: Body): ShotName[] {
  if (body.kind === 'star') return ['flyby', 'overview', 'skim'];
  if (body.kind === 'belt') return ['flyby', 'overview'];
  if (body.kind === 'moon') return ['earthrise', 'vista', 'flyby', 'overview', 'terminator'];
  if (body.ring) return ['flyby', 'vista', 'ringOrbit', 'overview', 'ringDive', 'silhouette', 'terminator'];
  return ['flyby', 'vista', 'skim', 'overview', 'terminator', 'silhouette'];
}

export const canEclipse = (body: Body) => body.kind === 'planet' || body.kind === 'moon';

export function eclipse(context: ShotContext, progress: number): Pose {
  const { body, center } = context;
  const { side } = frame(context);
  const away = normalize(center);
  const sweep = 1 - 2 * progress;
  const offset = Math.sign(sweep) * Math.abs(sweep) ** 3 * body.radius * ECLIPSE_SWEEP;
  const behind = (body.radius * length(center)) / (ECLIPSE_OVERSIZE * BODIES[0].radius - body.radius);
  return { position: combine(center, [away, behind], [side, offset]), look: ORIGIN };
}

export function eclipseCoverage(camera: Vec, center: Vec, radius: number) {
  const toSun = sub(ORIGIN, camera);
  const toBody = sub(center, camera);
  const sunDistance = length(toSun);
  const bodyDistance = length(toBody);
  if (bodyDistance >= sunDistance) return 0;
  const sunAngle = Math.asin(Math.min(1, BODIES[0].radius / sunDistance));
  const bodyAngle = Math.asin(Math.min(1, radius / bodyDistance));
  const separation = Math.acos(Math.max(-1, Math.min(1, dot(toSun, toBody) / (sunDistance * bodyDistance))));
  return clamp01((sunAngle + bodyAngle - separation) / (2 * Math.min(sunAngle, bodyAngle)));
}

export function bezier(p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number) {
  const u = 1 - t;
  return combine(ORIGIN, [p0, u * u * u], [p1, 3 * u * u * t], [p2, 3 * u * t * t], [p3, t * t * t]);
}

export function keepClear(point: Vec, centers: Vec[], endpoints: number[]) {
  return BODIES.reduce((current, body, i) => {
    if (body.kind === 'belt') return current;
    const safe = endpoints.includes(i) ? body.radius * ENDPOINT_SAFE_SCALE : outerRadius(body) * TRAVEL_SAFE_SCALE;
    const offset = sub(current, centers[i]);
    const gap = length(offset);
    return gap >= safe ? current : add(centers[i], normalize(offset), safe);
  }, point);
}
