import { useEffect, useRef } from 'react';
import { liveAccent } from '@/accent';
import { comfort } from '@/motion';

const BEAT_SECONDS = 60 / 128;
const WAVE_UNITS = 1200;
const POINTS = 480;
const DRIFT_SPEED = 0.35;
const KICK_BOOST = 0.12;
const STILL_TIME = 2;
const MAX_PIXEL_RATIO = 2;
const LINE_WIDTH = 1.25;
const ACCENT_LINE_WIDTH = 2;
const TRACES = [
  { amplitude: 0.85, phase: 0, accent: false },
  { amplitude: 0.5, phase: 2.1, accent: true },
];

function drawWaves(ctx: CanvasRenderingContext2D, width: number, height: number, pixelRatio: number, ink: string, time: number) {
  const kick = Math.exp(-((time % BEAT_SECONDS) / BEAT_SECONDS) * 6);
  const drift = time * DRIFT_SPEED;
  const mid = height / 2;
  ctx.clearRect(0, 0, width, height);
  for (const { amplitude, phase, accent } of TRACES) {
    ctx.strokeStyle = accent ? liveAccent() || ink : ink;
    ctx.lineWidth = (accent ? ACCENT_LINE_WIDTH : LINE_WIDTH) * pixelRatio;
    const scale = mid * amplitude * (accent ? 1 + kick * KICK_BOOST : 1);
    ctx.beginPath();
    for (let i = 0; i <= POINTS; i++) {
      const x = (i / POINTS) * WAVE_UNITS;
      const envelope = 0.25 + 0.75 * Math.abs(Math.sin((x / WAVE_UNITS) * Math.PI * 2.6 + 0.4 + drift * 0.3)) ** 1.6;
      const signal =
        Math.sin(x * 0.09 - drift * 3 + phase) +
        0.5 * Math.sin(x * 0.23 + 1 + drift * 2 + phase) +
        0.3 * Math.sin(x * 0.57 + 2 - drift * 5 + phase);
      const y = mid - (signal / 1.8) * envelope * scale;
      if (i) ctx.lineTo((i / POINTS) * width, y);
      else ctx.moveTo(0, y);
    }
    ctx.stroke();
  }
}

export function LiveCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let pixelRatio = 1;
    let ink = '';
    let frameId = 0;
    const resize = () => {
      pixelRatio = Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO);
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * pixelRatio));
      ink = getComputedStyle(canvas).color;
    };
    const tick = (now: number) => {
      drawWaves(ctx, canvas.width, canvas.height, pixelRatio, ink, comfort.reduced ? STILL_TIME : now / 1000);
      frameId = requestAnimationFrame(tick);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    frameId = requestAnimationFrame(tick);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameId);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
