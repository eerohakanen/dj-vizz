import { bandAt } from '../audio/spectrum';
import { gradientCache, sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { clamp01, follow, lerp, signedRandom, TAU } from '../math';
import { clock, fx, settings, signal, view } from '../state';
import { glideStyle, nextVariant } from './restyle';

const HUES = 6;
const DEPTH_BUCKETS = 3;
const LEVEL_BUCKETS = 2;
const LOUD_LEVEL = 0.35;
const QUIET_ALPHA = 0.55;
const STREAK_STRETCH = 3;
const MARGIN = 50;
const MIN_STARS = 120;
const MAX_STARS = 1000;
const DENSITY_ATTACK = 0.15;
const DENSITY_RELEASE = 1.5;
const ARRIVAL_DEPTH = 0.6;
const STYLES = [
  { focal: 0.5, pace: 1, stretch: STREAK_STRETCH, thickness: 1, twist: 0 },
  { focal: 0.38, pace: 0.8, stretch: 5, thickness: 0.7, twist: 0.7 },
  { focal: 0.65, pace: 1.2, stretch: 2, thickness: 1.3, twist: 0 },
  { focal: 0.5, pace: 0.9, stretch: 4, thickness: 1, twist: -0.7 },
];

interface Star {
  x: number;
  y: number;
  z: number;
  previousZ: number;
  hue: number;
  turn: number;
  live: boolean;
}

function respawn(star: Star) {
  star.x = signedRandom(2);
  star.y = signedRandom(2);
  star.z = Math.random() * 0.9 + 0.1;
  star.previousZ = star.z;
  star.hue = (Math.random() * HUES) | 0;
  star.turn = Math.abs(Math.atan2(star.y, star.x)) / Math.PI;
  return star;
}

function recycle(star: Star) {
  respawn(star);
  star.z = star.previousZ = 1;
}

function arrive(star: Star) {
  respawn(star);
  star.z = star.previousZ = ARRIVAL_DEPTH + Math.random() * (1 - ARRIVAL_DEPTH);
  star.live = true;
}

const stars = Array.from({ length: MAX_STARS }, (_, i) => respawn({ x: 0, y: 0, z: 0, previousZ: 0, hue: 0, turn: 0, live: i < MIN_STARS }));
const centerGlow = gradientCache(() => ctx.createRadialGradient(0, 0, 0, 0, 0, 1));
const buckets = Array.from({ length: HUES * DEPTH_BUCKETS * LEVEL_BUCKETS }, (): number[] => []);
let density = 0;
let activeStars = MIN_STARS;
let styleIndex = 0;
const style = { ...STYLES[0] };

export function restyleWarp(strength: number) {
  styleIndex = nextVariant(styleIndex, STYLES.length, strength);
}

function project(star: Star, z: number, focal: number) {
  const turn = style.twist * z;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return { x: ((star.x * cos - star.y * sin) / z) * focal, y: ((star.x * sin + star.y * cos) / z) * focal };
}

function updateActiveStars() {
  const target = clamp01(signal.energy * 1.2 + fx.drop * 0.6) * signal.gate;
  density = follow(density, target, DENSITY_ATTACK, DENSITY_RELEASE, clock.delta);
  activeStars = Math.round(lerp(MIN_STARS, MAX_STARS, density));
  for (let i = 0; i < activeStars; i++) if (!stars[i].live) arrive(stars[i]);
}

function retire(star: Star, index: number) {
  if (index < activeStars) recycle(star);
  else star.live = false;
}

function collectStreaks() {
  const { width, height, minSide } = view;
  const cx = width / 2;
  const cy = height / 2;
  const focal = minSide * style.focal;
  const speed = signal.gate * (0.12 + signal.punchBass * 2.2 + fx.drop * 5) * settings.motion * style.pace * clock.delta;
  for (const bucket of buckets) bucket.length = 0;
  updateActiveStars();
  for (let i = 0; i < MAX_STARS; i++) {
    const star = stars[i];
    if (!star.live) continue;
    star.previousZ = star.z;
    star.z -= speed;
    if (star.z < 0.02) {
      retire(star, i);
      continue;
    }
    const head = project(star, star.z, focal);
    const x = cx + head.x;
    const y = cy + head.y;
    if (x < -MARGIN || x > width + MARGIN || y < -MARGIN || y > height + MARGIN) {
      retire(star, i);
      continue;
    }
    const level = bandAt(star.turn, 1);
    const tailZ = star.z + (star.previousZ - star.z) * (1 + level * style.stretch);
    const tail = project(star, tailZ, focal);
    const previousX = cx + tail.x;
    const previousY = cy + tail.y;
    const nearness = 1 - star.z;
    const depthBucket = nearness < 0.33 ? 0 : nearness < 0.66 ? 1 : 2;
    const levelBucket = level > LOUD_LEVEL ? 1 : 0;
    buckets[(star.hue * DEPTH_BUCKETS + depthBucket) * LEVEL_BUCKETS + levelBucket].push(previousX, previousY, x, y);
  }
}

export function drawWarp() {
  const { width, height, pixelRatio } = view;
  const { punchBass, punchHigh } = signal;
  const cx = width / 2;
  const cy = height / 2;
  ctx.lineCap = 'round';
  glideStyle(style, STYLES[styleIndex]);
  collectStreaks();
  buckets.forEach((lines, b) => {
    if (!lines.length) return;
    const loud = b % LEVEL_BUCKETS === 1;
    const depthIndex = Math.floor(b / LEVEL_BUCKETS);
    const nearness = ((depthIndex % DEPTH_BUCKETS) + 0.5) / DEPTH_BUCKETS;
    const hue = (depthIndex / DEPTH_BUCKETS) | 0;
    const brightness = Math.min(1, nearness * 1.5 + punchHigh * 0.5 + fx.hat * 0.4 + fx.drop * 0.6) * (loud ? 1 : QUIET_ALPHA);
    ctx.strokeStyle = color(hue / 2 + nearness, brightness);
    ctx.lineWidth = (0.5 + nearness * 4 + punchHigh * 2) * (loud ? 1.4 : 1) * style.thickness * pixelRatio;
    ctx.beginPath();
    for (let i = 0; i < lines.length; i += 4) {
      ctx.moveTo(lines[i], lines[i + 1]);
      ctx.lineTo(lines[i + 2], lines[i + 3]);
    }
    ctx.stroke();
  });
  const glowRadius = (20 + punchBass * 140) * pixelRatio;
  ctx.save();
  ctx.fillStyle = centerGlow(color(0, 0.8, 75), color(1, 0));
  ctx.translate(cx, cy);
  ctx.scale(glowRadius, glowRadius);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();
}
