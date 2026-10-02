import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, vi } from 'vitest';

const DIR = 'eval';
const TOLERANCE = 1;
const TRACE_SECONDS = 4;
const TRACE_STEP = 0.25;
const SENSITIVITIES = [0.5, 0.75, 1, 1.5, 2];
const TIMEOUT = 60 * 60 * 1000;

interface TracePoint {
  time: number;
  level: number;
  groove: number;
  reduced: number;
  score: number;
  tension: number;
}

const tracks = existsSync(DIR) ? readdirSync(DIR).filter((file) => file.endsWith('.wav')) : [];

function parseTime(text: string) {
  const parts = text.split(':').map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function readLabels(wav: string) {
  const path = join(DIR, wav.replace(/\.wav$/, '.txt'));
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean)
    .map(parseTime)
    .filter((time) => Number.isFinite(time));
}

async function detect(wav: string, sensitivity: number) {
  vi.resetModules();
  const { decodeWav, replay } = await import('../src/audio/replay');
  const { dropState, registerDrop } = await import('../src/audio/drop');
  const { clock, settings, signal } = await import('../src/state');
  settings.dropSensitivity = sensitivity;
  const bytes = readFileSync(join(DIR, wav));
  const pcm = decodeWav(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const drops: number[] = [];
  const trace: TracePoint[] = [];
  const ignore = () => {};
  const events = {
    onBeat: ignore,
    onKick: ignore,
    onSnare: ignore,
    onHat: ignore,
    onDrop() {
      drops.push(clock.time);
      registerDrop();
    },
  };
  replay(pcm, events, (time) => {
    const last = trace[trace.length - 1];
    if (last && time - last.time < TRACE_STEP) return;
    const { level, groove, reduced, score } = dropState;
    trace.push({ time, level, groove, reduced, score, tension: signal.tension });
  });
  return { drops, trace };
}

function match(labels: number[], drops: number[]) {
  const unused = new Set(drops);
  const hits: number[] = [];
  const misses: number[] = [];
  for (const label of labels) {
    const nearest = [...unused].sort((a, b) => Math.abs(a - label) - Math.abs(b - label))[0];
    if (nearest !== undefined && Math.abs(nearest - label) <= TOLERANCE) {
      unused.delete(nearest);
      hits.push(label);
    } else misses.push(label);
  }
  return { hits, misses, falseDrops: [...unused] };
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;

function printMiss(label: number, trace: TracePoint[]) {
  console.log(`  missed ${clock(label)}`);
  for (const point of trace) {
    if (point.time < label - TRACE_SECONDS || point.time > label + TOLERANCE) continue;
    const { time, level, groove, reduced, score, tension } = point;
    console.log(
      `    ${clock(time)}  low ${level.toFixed(2)}  groove ${groove.toFixed(2)}  reduced ${reduced}  score ${score.toFixed(2)}  tension ${tension.toFixed(2)}`,
    );
  }
}

describe.skipIf(!process.env.DROP_EVAL || tracks.length === 0)('drop detection on labelled audio', () => {
  for (const wav of tracks) {
    it(
      wav,
      async () => {
        const labels = readLabels(wav);
        console.log(`\n${wav}: ${labels.length} labelled drops`);
        for (const sensitivity of SENSITIVITIES) {
          const { drops, trace } = await detect(wav, sensitivity);
          const { hits, misses, falseDrops } = match(labels, drops);
          console.log(`sensitivity ${sensitivity}: ${hits.length} hit, ${misses.length} missed, ${falseDrops.length} false`);
          if (sensitivity !== 1) continue;
          console.log(`  detected ${drops.map(clock).join(', ') || 'none'}`);
          if (falseDrops.length) console.log(`  false ${falseDrops.map(clock).join(', ')}`);
          for (const miss of misses) printMiss(miss, trace);
        }
      },
      TIMEOUT,
    );
  }
});
