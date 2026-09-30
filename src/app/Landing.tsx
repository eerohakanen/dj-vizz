import { ArrowRight, AudioLines, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lastAudioSource } from '@/session';
import { SOURCES, sourceLabel } from './labels';
import { useSourceCapture } from './shared';

interface LandingProps {
  onStart: () => void;
  onResume: () => void;
}

export function Landing({ onStart, onResume }: LandingProps) {
  const { pending, connect } = useSourceCapture(onResume);
  const last = lastAudioSource();
  const resumable = SOURCES.find((source) => source.kind === last && !source.unsupported);
  return (
    <main className="fixed inset-0 flex items-center justify-center overflow-hidden px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,oklch(0.55_0.25_320/0.35),transparent_55%),radial-gradient(ellipse_at_75%_80%,oklch(0.6_0.2_200/0.3),transparent_55%)]" />
      <div className="relative flex max-w-xl flex-col items-center gap-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl border bg-card shadow-lg backdrop-blur">
          <AudioLines className="size-8 text-primary" />
        </div>
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">DJ Visualizer</h1>
          <p className="text-lg text-muted-foreground">
            Live, beat-reactive visuals for your mix. Point it at a microphone or a window and let the music drive the
            show.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          {resumable && (
            <Button
              size="lg"
              className="h-12 rounded-full px-8 text-base"
              disabled={!!pending}
              onClick={() => connect(resumable)}
              autoFocus
            >
              {pending ? <Loader2 className="animate-spin" /> : <Play />}
              Resume with {sourceLabel(resumable.kind)}
            </Button>
          )}
          <Button
            size="lg"
            variant={resumable ? 'secondary' : 'default'}
            className="h-12 rounded-full px-8 text-base"
            disabled={!!pending}
            onClick={onStart}
            autoFocus={!resumable}
          >
            Get started
            <ArrowRight />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Runs entirely in your browser. Nothing is recorded or uploaded.</p>
      </div>
    </main>
  );
}
