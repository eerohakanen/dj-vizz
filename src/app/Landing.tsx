import { Compass, ListMusic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { explore, openPresets } from '@/actions';
import { MenuBackdrop } from './shared';

export function Landing() {
  return (
    <main className="fixed inset-0 overflow-y-auto">
      <MenuBackdrop />
      <div className="relative mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-8 px-6 py-12 text-center">
        <div className="space-y-4">
          <h1 className="font-display text-[2.5rem] leading-none tracking-[-0.01em] text-balance text-brand sm:text-6xl">DJ Visualizer</h1>
          <p className="text-lg text-muted-foreground">
            Live, beat-reactive visuals for your mix. Point it at a microphone or a window and let the music drive the
            show.
          </p>
        </div>
        <Button size="lg" className="h-13 px-9 text-lg" onClick={explore} autoFocus>
          <Compass className="size-5" />
          Try it now
        </Button>
        <div className="flex w-full max-w-xs flex-col items-center gap-2 border-t pt-6">
          <Button variant="outline" className="px-6" onClick={openPresets}>
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
