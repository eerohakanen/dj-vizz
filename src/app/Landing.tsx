import { AudioLines, Compass, ListMusic, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { explore, openPresets } from '@/actions';
import { lastAudioSource } from '@/session';
import { SOURCES, sourceLabel } from './labels';
import { useSourceCapture } from './shared';

export function Landing() {
  const { pending, connect } = useSourceCapture(explore);
  const last = lastAudioSource();
  const resumable = SOURCES.find((source) => source.kind === last && !source.unsupported);
  return (
    <main className="fixed inset-0 overflow-y-auto">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_30%_20%,oklch(0.55_0.25_320/0.35),transparent_55%),radial-gradient(ellipse_at_75%_80%,oklch(0.6_0.2_200/0.3),transparent_55%)]" />
      <div className="relative mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-8 px-6 py-12 text-center">
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
        <div className="flex flex-col items-center gap-2">
          <Button
            size="lg"
            className="h-14 rounded-full px-10 text-lg shadow-lg shadow-primary/25"
            disabled={!!pending}
            onClick={() => (resumable ? connect(resumable) : explore())}
            autoFocus
          >
            {pending ? <Loader2 className="size-5 animate-spin" /> : <Compass className="size-5" />}
            Explore
          </Button>
          {resumable && (
            <p className="text-sm text-muted-foreground">
              With {sourceLabel(resumable.kind)} ·{' '}
              <Button
                variant="link"
                className="h-auto p-0 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                disabled={!!pending}
                onClick={explore}
              >
                Choose another source
              </Button>
            </p>
          )}
        </div>
        <div className="flex w-full max-w-xs flex-col items-center gap-2 border-t pt-6">
          <Button variant="outline" className="rounded-full px-6" disabled={!!pending} onClick={openPresets}>
            <ListMusic />
            My presets
          </Button>
          <p className="text-sm text-muted-foreground">Build sequences of scenes for your set.</p>
        </div>
        <p className="text-xs text-muted-foreground">Runs entirely in your browser. Nothing is recorded or uploaded.</p>
      </div>
    </main>
  );
}
