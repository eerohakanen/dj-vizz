import { fx, signal } from '@/state';
import { cn } from '@/lib/utils';
import { GLASS_PANEL, MeterBar, useTicker } from './shared';

const PITCHES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

const keyName = (key: number) => (key < 0 ? '—' : key >= 12 ? `${PITCHES[key - 12]}m` : PITCHES[key]);

function Hit({ label, level }: { label: string; level: number }) {
  return (
    <span
      className="inline-flex size-7 items-center justify-center rounded-full border border-border font-semibold"
      style={{ backgroundColor: `rgba(255,255,255,${Math.min(1, level) * 0.85})`, color: level > 0.5 ? '#000' : undefined }}
    >
      {label}
    </span>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-muted-foreground">{label}</span>
      <MeterBar value={value} className="w-28" fillClassName="bg-foreground" />
    </div>
  );
}

export function AnalysisHud() {
  useTicker();
  const bar = Math.floor(signal.phraseBeat / 4) + 1;
  return (
    <div className={cn('pointer-events-none fixed top-3 left-3 flex flex-col gap-2 rounded-lg border border-border p-3 font-mono text-xs', GLASS_PANEL)}>
      <div className="flex items-center gap-2">
        <Hit label="K" level={fx.kick} />
        <Hit label="S" level={fx.snare} />
        <Hit label="H" level={fx.hat} />
        <span className="ml-2">{signal.bpm ? `${signal.bpm.toFixed(1)} BPM` : 'no lock'}</span>
      </div>
      <div className="flex items-center gap-1">
        {[0, 1, 2, 3].map((beat) => (
          <span key={beat} className={cn('h-2 w-6 rounded-sm bg-muted', signal.beatInBar === beat && 'bg-foreground')} />
        ))}
        <span className="ml-2">
          bar {bar}/8 · beat {signal.phraseBeat + 1}/32
        </span>
      </div>
      <Meter label="tempo" value={signal.tempoConfidence} />
      <Meter label="tension" value={signal.tension} />
      <Meter label="bright" value={signal.brightness} />
      <Meter label="vocal" value={signal.vocal} />
      <div className="flex items-center gap-2">
        <span className="w-16 text-muted-foreground">key</span>
        <span>
          {keyName(signal.key)} ({signal.keyConfidence.toFixed(2)})
        </span>
      </div>
    </div>
  );
}
