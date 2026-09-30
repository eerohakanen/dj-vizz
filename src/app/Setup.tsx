import { useState } from 'react';
import { ArrowLeft, Check, FolderOpen, Loader2, MicIcon, MonitorSpeaker, Play, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { audio, captureMicrophone, captureWindow } from '@/audio/input';
import { library, playlist } from '@/presets/library';
import { playFolder, setChangeOn, setShuffle } from '@/presets/playlist';
import { cn } from '@/lib/utils';
import { CHANGE_OPTIONS, SOURCE_LABELS } from './labels';

const SOURCES = [
  {
    kind: 'window',
    icon: MonitorSpeaker,
    title: 'Window audio',
    description: 'Share a tab, window or your entire screen. Turn on "Share audio" in the picker.',
    capture: captureWindow,
  },
  {
    kind: 'mic',
    icon: MicIcon,
    title: 'Microphone',
    description: 'Listen to the room through your mic or an audio interface.',
    capture: captureMicrophone,
  },
];

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

type Source = (typeof SOURCES)[number];

function SourceStep({ onConnected }: { onConnected: () => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = async (source: Source) => {
    setPending(source.kind);
    setError(null);
    const result = await source.capture();
    setPending(null);
    if (result.ok) onConnected();
    else setError(result.error ?? null);
  };

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
            disabled={!!pending}
            onClick={() => connect(source)}
            className="group rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <Card className="h-full transition-colors group-hover:border-primary/60 group-hover:bg-accent/60">
              <CardHeader>
                <div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  {pending === source.kind ? <Loader2 className="size-5 animate-spin" /> : <source.icon className="size-5" />}
                </div>
                <CardTitle>{source.title}</CardTitle>
                <CardDescription>{source.description}</CardDescription>
              </CardHeader>
            </Card>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}

function VisualsStep({ onDone }: { onDone: () => void }) {
  const [folder, setFolder] = useState(String(library.cur));
  const presetCount = library.folders[+folder]?.presets.length ?? 0;

  const startFolder = () => {
    playFolder(+folder);
    onDone();
  };

  return (
    <>
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">How do you want to start?</h2>
        <p className="text-muted-foreground">
          Connected to {(audio.source && SOURCE_LABELS[audio.source]) ?? 'audio'}. Play a saved preset folder or explore freely.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <FolderOpen className="size-5" />
            </div>
            <CardTitle>Play a preset folder</CardTitle>
            <CardDescription>Cycles through your saved looks automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Folder</Label>
              <Select value={folder} onValueChange={setFolder}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {library.folders.map((item, index) => (
                    <SelectItem key={index} value={String(index)}>
                      {item.name} · {item.presets.length} preset{item.presets.length === 1 ? '' : 's'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Change look</Label>
              <Select value={playlist.changeOn} onValueChange={setChangeOn}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="setup-shuffle">Shuffle</Label>
              <Switch id="setup-shuffle" checked={playlist.shuffle} onCheckedChange={setShuffle} />
            </div>
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
            <div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <SlidersHorizontal className="size-5" />
            </div>
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
