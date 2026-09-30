import { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openOverlay } from '@/actions';
import { audio } from '@/audio/input';
import { trackSilence } from '@/audio/silence';
import { signal } from '@/state';
import { ui, useEngine } from '@/store';
import { cn } from '@/lib/utils';
import { SOURCES } from './labels';
import { FLOATING_PANEL, useSourceCapture } from './shared';

const SILENCE_POLL_MS = 250;
const SILENCE_HINTS = { window: 'the shared tab has audio', mic: 'the microphone' } as const;
const PILL = 'pointer-events-auto flex items-center gap-3 rounded-md border py-1.5 pr-1.5 pl-4 text-sm';

function ReconnectPill() {
  const { pending, connect } = useSourceCapture();
  const source = SOURCES.find(({ kind }) => kind === audio.lost);
  if (!source) return null;
  return (
    <div role="alert" className={cn(PILL, FLOATING_PANEL)}>
      <span>Audio disconnected</span>
      <Button size="sm" disabled={!!pending || !!source.unsupported} onClick={() => connect(source)}>
        {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Reconnect
      </Button>
    </div>
  );
}

function SilencePill() {
  const tracker = useRef({ since: null as number | null });
  const [silent, setSilent] = useState(false);
  useEffect(() => {
    const check = () => setSilent(trackSilence(tracker.current, audio.live && !ui.paused, signal.energy, performance.now()));
    const timer = setInterval(check, SILENCE_POLL_MS);
    return () => clearInterval(timer);
  }, []);
  if (!silent) return null;
  return (
    <div role="status" className={cn(PILL, FLOATING_PANEL)}>
      <span>No sound detected. Check {SILENCE_HINTS[audio.source ?? 'window']}, or raise Input level.</span>
      <Button size="sm" variant="secondary" onClick={() => openOverlay('tuning')}>
        <SlidersHorizontal />
        Tune
      </Button>
    </div>
  );
}

export function StatusPills() {
  useEngine();
  return (
    <div className="pointer-events-none fixed top-[calc(0.75rem+env(safe-area-inset-top,0px))] left-1/2 z-50 flex w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-col items-center gap-2">
      <ReconnectPill />
      <SilencePill />
    </div>
  );
}
