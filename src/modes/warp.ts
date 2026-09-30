import { bandAt } from '../audio/spectrum';
import { gradientCache, sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { signedRandom, TAU } from '../math';
import { clock, fx, settings, signal, view } from '../state';

const HUES = 6;
const DEPTH_BUCKETS = 3;
const LEVEL_BUCKETS = 2;
const LOUD_LEVEL = 0.35;
const QUIET_ALPHA = 0.55;
const STREAK_STRETCH = 3;
const MARGIN = 50;

interface Star {
  x: number;
  y: number;
  z: number;
  previousZ: number;
  hue: number;
  turn: number;
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

const stars = Array.from({ length: 600 }, () => respawn({ x: 0, y: 0, z: 0, previousZ: 0, hue: 0, turn: 0 }));
const centerGlow = gradientCache(() => ctx.createRadialGradient(0, 0, 0, 0, 0, 1));
const buckets = Array.from({ length: HUES * DEPTH_BUCKETS * LEVEL_BUCKETS }, (): number[] => []);

function collectStreaks() {
  const { width, height, minSide } = view;
  const cx = width / 2;
  const cy = height / 2;
  const focal = minSide * 0.5;
  const speed = signal.gate * (0.12 + signal.punchBass * 2.2 + fx.drop * 5) * settings.motion * clock.delta;
  for (const bucket of buckets) bucket.length = 0;
  for (const star of stars) {
    star.previousZ = star.z;
    star.z -= speed;
    if (star.z < 0.02) {
      recycle(star);
      continue;
    }
    const x = cx + (star.x / star.z) * focal;
    const y = cy + (star.y / star.z) * focal;
    if (x < -MARGIN || x > width + MARGIN || y < -MARGIN || y > height + MARGIN) {
      recycle(star);
      continue;
    }
    const level = bandAt(star.turn, 1);
    const tailZ = star.z + (star.previousZ - star.z) * (1 + level * STREAK_STRETCH);
    const previousX = cx + (star.x / tailZ) * focal;
    const previousY = cy + (star.y / tailZ) * focal;
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
  collectStreaks();
  buckets.forEach((lines, b) => {
    if (!lines.length) return;
    const loud = b % LEVEL_BUCKETS === 1;
    const depthIndex = Math.floor(b / LEVEL_BUCKETS);
    const nearness = ((depthIndex % DEPTH_BUCKETS) + 0.5) / DEPTH_BUCKETS;
    const hue = (depthIndex / DEPTH_BUCKETS) | 0;
    const brightness = Math.min(1, nearness * 1.5 + punchHigh * 0.5) * (loud ? 1 : QUIET_ALPHA);
    ctx.strokeStyle = color(hue / 2 + nearness, brightness);
    ctx.lineWidth = (0.5 + nearness * 4 + punchHigh * 2) * (loud ? 1.4 : 1) * pixelRatio;
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
