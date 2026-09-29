import { sceneCtx as ctx } from '../canvas.js';
import { color } from '../color.js';
import { TAU } from '../math.js';
import { view } from '../state.js';

const MAX_PARTICLES = 1500;
const COLOR_GROUPS = 4;

const particles = [];
let shockwaves = [];

export function burst(count, minSpeed, speedRange, life) {
  const { width, height, pixelRatio } = view;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TAU;
    const speed = (minSpeed + Math.random() * speedRange) * pixelRatio;
    particles.push({
      x: width / 2,
      y: height / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      group: (Math.random() * COLOR_GROUPS) | 0,
      size: (2 + Math.random() * 6) * pixelRatio,
    });
  }
  if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
}

export function addShockwave(radius = 0) {
  shockwaves.push({ radius });
}

export function drawShockwaves() {
  const { width, height, diagonal, pixelRatio } = view;
  shockwaves = shockwaves.filter((wave) => wave.radius < diagonal);
  for (const wave of shockwaves) {
    wave.radius += (26 + wave.radius * 0.05) * pixelRatio;
    const alpha = Math.max(0, 1 - wave.radius / diagonal);
    ctx.strokeStyle = color(wave.radius / 300, alpha, 65);
    ctx.lineWidth = (6 + alpha * 26) * pixelRatio;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, wave.radius, 0, TAU);
    ctx.stroke();
  }
}

export function drawParticles() {
  let alive = 0;
  for (const particle of particles) {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vx *= 0.985;
    particle.vy *= 0.985;
    particle.life -= 0.02;
    if (particle.life > 0) particles[alive++] = particle;
  }
  particles.length = alive;
  for (let group = 0; group < COLOR_GROUPS; group++) {
    ctx.fillStyle = color(group * 0.75);
    for (const particle of particles) {
      if (particle.group !== group) continue;
      ctx.globalAlpha = Math.min(1, particle.life);
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
  }
}
