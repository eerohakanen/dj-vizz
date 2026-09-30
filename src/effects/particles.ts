import { sceneCtx as ctx } from '../canvas';
import { color } from '../color';
import { decay, frameScale, signedRandom, TAU } from '../math';
import { createPool } from '../pool';
import { clock, settings, view } from '../state';

const MAX_PARTICLES = 1500;
const COLOR_GROUPS = 4;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  group: number;
  size: number;
}

const particles = createPool<Particle>(MAX_PARTICLES, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, group: 0, size: 0 }));
const shockwaves: { radius: number }[] = [];

export function burst(count: number, minSpeed: number, speedRange: number, life: number, scatter = 0, sizeScale = 1) {
  const { width, height, pixelRatio } = view;
  const scaled = Math.round(count * settings.particles);
  for (let i = 0; i < scaled; i++) {
    const angle = Math.random() * TAU;
    const speed = (minSpeed + Math.random() * speedRange) * pixelRatio;
    const particle = particles.acquire();
    particle.x = width / 2 + signedRandom(width * scatter);
    particle.y = height / 2 + signedRandom(height * scatter);
    particle.vx = Math.cos(angle) * speed;
    particle.vy = Math.sin(angle) * speed;
    particle.life = life;
    particle.group = (Math.random() * COLOR_GROUPS) | 0;
    particle.size = (2 + Math.random() * 6) * pixelRatio * sizeScale;
  }
}

export const sparkle = (count: number) => burst(count, 0.2, 1.2, 0.5, 0.9, 0.45);

export function addShockwave(radius = 0) {
  shockwaves.push({ radius });
}

export function drawShockwaves() {
  const { width, height, diagonal, pixelRatio } = view;
  const step = frameScale(clock.delta);
  let alive = 0;
  for (const wave of shockwaves) {
    if (wave.radius >= diagonal) continue;
    shockwaves[alive++] = wave;
    wave.radius += (26 + wave.radius * 0.05) * pixelRatio * step;
    const alpha = Math.max(0, 1 - wave.radius / diagonal);
    ctx.strokeStyle = color(wave.radius / 300, alpha, 65);
    ctx.lineWidth = (6 + alpha * 26) * pixelRatio;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, wave.radius, 0, TAU);
    ctx.stroke();
  }
  shockwaves.length = alive;
}

export function drawParticles() {
  const step = frameScale(clock.delta);
  const drag = decay(0.985, step);
  const { items } = particles;
  for (let i = 0; i < particles.active; ) {
    const particle = items[i];
    particle.x += particle.vx * step;
    particle.y += particle.vy * step;
    particle.vx *= drag;
    particle.vy *= drag;
    particle.life -= 0.02 * step;
    if (particle.life > 0) i++;
    else particles.release(i);
  }
  for (let group = 0; group < COLOR_GROUPS; group++) {
    ctx.fillStyle = color(group * 0.75);
    for (let i = 0; i < particles.active; i++) {
      const particle = items[i];
      if (particle.group !== group) continue;
      ctx.globalAlpha = Math.min(1, particle.life);
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
  }
}
