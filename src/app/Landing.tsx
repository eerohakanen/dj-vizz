import { Compass, Download, ListMusic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { explore, openPresets } from '@/actions';
import { isDesktop } from '@/desktop';
import { downloadsFor } from '@/downloads';
import { MenuBackdrop } from './shared';

function DesktopDownloads() {
  const downloads = downloadsFor(navigator.userAgent);
  if (!downloads.length) return null;
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-2 border-t pt-6">
      <div className="flex flex-wrap justify-center gap-2">
        {downloads.map((download) => (
          <Button key={download.platform} variant="outline" className="px-5" asChild>
            <a href={download.url}>
              <Download />
              {download.label}
            </a>
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        The desktop app keeps the show running in the background and lets you pick your audio input.
      </p>
      <p className="text-xs text-muted-foreground">
        Not yet signed: on Mac, open it once, then choose Open Anyway in System Settings, Privacy & Security. On Windows, choose More info, then Run anyway.
      </p>
    </div>
  );
}

export function Landing() {
  return (
    <main className="fixed inset-0 overflow-y-auto">
      <MenuBackdrop live />
      <div className="relative mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-8 px-6 py-12 text-center">
        <div className="space-y-5">
          <h1 className="font-display text-[2.75rem] leading-[0.9] font-bold tracking-[-0.06em] text-balance uppercase sm:text-7xl">
            <span className="bg-live px-[0.08em] text-live-foreground">DJ</span> Visualizer
          </h1>
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
        {!isDesktop && <DesktopDownloads />}
        <p className="text-xs text-muted-foreground">
          Runs entirely {isDesktop ? 'on your computer' : 'in your browser'}. Nothing is recorded or uploaded.
        </p>
      </div>
    </main>
  );
}
