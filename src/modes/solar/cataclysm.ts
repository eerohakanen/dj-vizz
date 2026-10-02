import { clamp01, lerp, smoothstep } from '../../math';
import { BODIES } from './bodies';
import { type Pose, vec, type Vec } from './shots';

export type Phase = 'idle' | 'supernova' | 'collapse' | 'dive' | 'done';

type RunningPhase = Exclude<Phase, 'idle' | 'done'>;

export const PHASE_BARS: Record<RunningPhase, number> = { supernova: 3, collapse: 4, dive: 2 };
export const UNLOCKED_BAR_SECONDS = 2;
export const IGNITE_TENSION = 0.6;
export const FALLBACK_DROPS = 3;
export const MIN_VISIT_SECONDS = 8;
export const MAX_SHOCK = 230;
export const HOLE_RADIUS = 4;
export const WRECK_DISTANCE = 40;

const NEXT: Record<RunningPhase, Phase> = { supernova: 'collapse', collapse: 'dive', dive: 'done' };
const ORIGIN: Vec = { x: 0, y: 0, z: 0 };
const VANTAGE_NEAR = 70;
const VANTAGE_FAR = 150;
const ORBIT_RADIUS = 34;
const HIGH = 0.35;
const LOW = 0.12;
const SUPERNOVA_SWING = 0.6;
const COLLAPSE_SWING = 1.5;
const DIVE_TURNS = 6;
const DIVE_FLOOR = 0.3;
const BLAST = 0.5;
const PULL_TURNS = 2.5;

export interface Cataclysm {
  phase: Phase;
  bars: number;
  angle: number;
  visitSeconds: number;
  drops: number;
}

export const createCataclysm = (): Cataclysm => ({ phase: 'idle', bars: 0, angle: 0, visitSeconds: 0, drops: 0 });

export const resetCataclysm = (cataclysm: Cataclysm) => Object.assign(cataclysm, createCataclysm());

export const busy = ({ phase }: Cataclysm) => phase !== 'idle';

export const progress = ({ phase, bars }: Cataclysm) => (phase === 'idle' || phase === 'done' ? 0 : clamp01(bars / PHASE_BARS[phase]));

export const phaseLevel = (cataclysm: Cataclysm, phase: RunningPhase) => {
  const order: Phase[] = ['supernova', 'collapse', 'dive', 'done'];
  const at = order.indexOf(cataclysm.phase);
  const target = order.indexOf(phase);
  if (at < 0 || at < target) return 0;
  return at > target ? 1 : progress(cataclysm);
};

export function shouldIgnite(cataclysm: Cataclysm, tensionPeak: number) {
  if (busy(cataclysm) || cataclysm.visitSeconds < MIN_VISIT_SECONDS) return false;
  return tensionPeak >= IGNITE_TENSION || cataclysm.drops + 1 >= FALLBACK_DROPS;
}

export const ignite = (cataclysm: Cataclysm, angle: number) => Object.assign(cataclysm, { phase: 'supernova', bars: 0, angle, drops: 0 });

export function stepCataclysm(cataclysm: Cataclysm, delta: number, barSeconds: number) {
  if (cataclysm.phase === 'idle') {
    cataclysm.visitSeconds += delta;
    return;
  }
  if (cataclysm.phase === 'done') return;
  cataclysm.bars += delta / barSeconds;
  while (cataclysm.phase !== 'done' && cataclysm.bars >= PHASE_BARS[cataclysm.phase as RunningPhase]) {
    cataclysm.bars -= PHASE_BARS[cataclysm.phase as RunningPhase];
    cataclysm.phase = NEXT[cataclysm.phase as RunningPhase];
  }
  if (cataclysm.phase === 'done') cataclysm.bars = 0;
}

export const shockRadius = (cataclysm: Cataclysm) =>
  lerp(BODIES[0].radius, MAX_SHOCK, 1 - (1 - phaseLevel(cataclysm, 'supernova')) ** 2.2);

function orbit(angle: number, radius: number, height: number): Pose {
  return { position: vec(Math.cos(angle) * radius, radius * height, -Math.sin(angle) * radius), look: ORIGIN };
}

export const survival = (shock: number, reach: number) => 1 - smoothstep(clamp01((shock - reach) / WRECK_DISTANCE));

export const pullLevel = (cataclysm: Cataclysm) => smoothstep(clamp01(phaseLevel(cataclysm, 'collapse') * 1.25));

export function cataclysmPose(cataclysm: Cataclysm): Pose {
  const t = progress(cataclysm);
  const eased = smoothstep(t);
  const { angle } = cataclysm;
  if (cataclysm.phase === 'supernova') return orbit(angle + t * SUPERNOVA_SWING, lerp(VANTAGE_NEAR, VANTAGE_FAR, eased), HIGH);
  if (cataclysm.phase === 'collapse')
    return orbit(angle + SUPERNOVA_SWING + t * COLLAPSE_SWING, lerp(VANTAGE_FAR, ORBIT_RADIUS, eased), lerp(HIGH, LOW, eased));
  const start = angle + SUPERNOVA_SWING + COLLAPSE_SWING;
  if (cataclysm.phase === 'dive') return orbit(start + t * t * DIVE_TURNS, Math.max(DIVE_FLOOR, ORBIT_RADIUS * (1 - t) ** 2), LOW * (1 - t));
  return orbit(start + DIVE_TURNS, DIVE_FLOOR, 0);
}

export function displace(point: Vec, shock: number, pull: number): Vec {
  const distance = Math.hypot(point.x, point.y, point.z) || 1;
  const blasted = shock > distance ? (distance + (shock - distance) * BLAST) / distance : 1;
  const shrink = blasted * (1 - pull * 0.97);
  const turn = pull * pull * PULL_TURNS;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const x = point.x * shrink;
  const z = point.z * shrink;
  return vec(x * cos - z * sin, point.y * shrink * (1 - pull), x * sin + z * cos);
}
