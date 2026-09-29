import { ArrowRight, AudioLines } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Landing({ onStart }) {
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
        <Button size="lg" className="h-12 rounded-full px-8 text-base" onClick={onStart} autoFocus>
          Get started
          <ArrowRight />
        </Button>
        <p className="text-xs text-muted-foreground">Runs entirely in your browser. Nothing is recorded or uploaded.</p>
      </div>
    </main>
  );
}
