import { Loader2 } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { currentFolder } from '@/presets/library';
import { ui } from '@/store';
import { SOURCES } from './labels';
import { IconTile, MenuBackdrop, MenuNav, useSourceCapture } from './shared';

function setupHeading() {
  const name = currentFolder()?.name;
  if (!name || ui.liveMode === 'explore') return 'Where is the music coming from?';
  return `Connect audio to ${ui.liveMode} "${name}"`;
}

function SourceStep({ onConnected }: { onConnected: () => void }) {
  const { pending, connect } = useSourceCapture(onConnected);

  return (
    <>
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{setupHeading()}</h2>
        <p className="text-muted-foreground">Pick an audio source. Your browser will ask for permission next.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SOURCES.map((source) => (
          <button
            key={source.kind}
            type="button"
            disabled={!!pending || !!source.unsupported}
            onClick={() => connect(source)}
            className="group rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <Card className="h-full transition-colors group-hover:border-primary/60 group-hover:bg-accent">
              <CardHeader>
                <IconTile>
                  {pending === source.kind ? <Loader2 className="size-5 animate-spin" /> : <source.icon className="size-5" />}
                </IconTile>
                <CardTitle>{source.label}</CardTitle>
                <CardDescription>{source.unsupported ?? source.description}</CardDescription>
              </CardHeader>
            </Card>
          </button>
        ))}
      </div>
    </>
  );
}

export function Setup({ onDone }: { onDone: () => void }) {
  return (
    <main className="fixed inset-0 flex flex-col overflow-y-auto">
      <MenuBackdrop />
      <MenuNav screen="setup" width="max-w-3xl" />
      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-10 sm:px-6 sm:py-12">
        <SourceStep onConnected={onDone} />
      </div>
    </main>
  );
}
