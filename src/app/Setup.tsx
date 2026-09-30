import { useState } from 'react';
import { ArrowLeft, Check, FolderOpen, Loader2, Play, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { audio } from '@/audio/input';
import { library } from '@/presets/library';
import { playFolder } from '@/presets/playlist';
import { cn } from '@/lib/utils';
import { SOURCES, sourceLabel } from './labels';
import { FolderSelect, IconTile, PlaybackOptions, useSourceCapture } from './shared';

function Steps({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {['Audio source', 'Visuals'].map((label, index) => (
        <div key={label} className="flex items-center gap-2">
          {index > 0 && <div className="h-px w-8 bg-border" />}
          <div
            className={cn(
              'flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold',
              index < step && 'border-primary bg-primary text-primary-foreground',
              index === step && 'border-primary text-primary',
            )}
          >
            {index < step ? <Check className="size-3.5" /> : index + 1}
          </div>
          <span className={cn(index === step && 'text-foreground')}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function SourceStep({ onConnected }: { onConnected: () => void }) {
  const { pending, connect } = useSourceCapture(onConnected);

  return (
    <>
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">Where is the music coming from?</h2>
        <p className="text-muted-foreground">Your browser will ask for permission next.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SOURCES.map((source) => (
          <button
            key={source.kind}
            type="button"
            disabled={!!pending || !!source.unsupported}
            onClick={() => connect(source)}
            className="group rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <Card className="h-full transition-colors group-hover:border-primary/60 group-hover:bg-accent/60">
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

function VisualsStep({ onDone }: { onDone: () => void }) {
  const [folder, setFolder] = useState(library.cur);
  const presetCount = library.folders[folder]?.presets.length ?? 0;

  const startFolder = () => {
    playFolder(folder);
    onDone();
  };

  return (
    <>
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">How do you want to start?</h2>
        <p className="text-muted-foreground">
          Connected to {sourceLabel(audio.source) ?? 'audio'}. Play a saved preset folder or explore freely.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <IconTile>
              <FolderOpen className="size-5" />
            </IconTile>
            <CardTitle>Play a preset folder</CardTitle>
            <CardDescription>Cycles through your saved looks automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Folder</Label>
              <FolderSelect value={folder} onChange={setFolder} className="w-full" verbose />
            </div>
            <PlaybackOptions />
          </CardContent>
          <CardFooter>
            <Button className="w-full" disabled={!presetCount} onClick={startFolder}>
              <Play />
              {presetCount ? 'Play folder' : 'Folder is empty'}
            </Button>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <IconTile>
              <SlidersHorizontal className="size-5" />
            </IconTile>
            <CardTitle>Free play</CardTitle>
            <CardDescription>
              Try modes, palettes and effects from the toolbar. Save any look you like as a preset.
            </CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto">
            <Button variant="secondary" className="w-full" onClick={onDone}>
              Start exploring
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}

export function Setup({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [step, setStep] = useState(0);

  return (
    <main className="fixed inset-0 overflow-y-auto bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-8 px-6 py-12">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={step ? () => setStep(0) : onBack}>
            <ArrowLeft />
            Back
          </Button>
          <Steps step={step} />
          <div className="w-16" />
        </div>
        {step === 0 ? <SourceStep onConnected={() => setStep(1)} /> : <VisualsStep onDone={onDone} />}
      </div>
    </main>
  );
}
