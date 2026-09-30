import { useEffect, useId, useState, type ComponentProps, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { AudioSourceKind } from '@/audio/sources';
import { showWarning } from '@/dom';
import { closeOverlay } from '@/actions';
import { currentFolder } from '@/presets/library';
import { currentChangeOn, currentShuffle, setChangeOn, setShuffle, setTransition } from '@/presets/playlist';
import { clamp01 } from '@/math';
import { ui, type Overlay } from '@/store';
import { cn } from '@/lib/utils';
import { CHANGE_OPTIONS, findChangeOption } from '@/presets/change';
import { DEFAULT_TRANSITION, findTransition, TRANSITIONS } from '@/effects/transition';
import { audio } from '@/audio/input';
import { Button } from '@/components/ui/button';
import type { Palette } from '@/palettes';
import { SOURCES, type SourceOption } from './labels';

export const GLASS_PANEL = 'bg-card/80 shadow-2xl backdrop-blur-xl';

export function useOverlay(name: Overlay) {
  return {
    open: ui.overlay === name,
    onOpenChange: (open: boolean) => {
      if (!open) closeOverlay();
    },
  };
}

export function useTicker(active = true, interval = 0) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const bump = () => setTick((tick) => tick + 1);
    if (interval) {
      const timer = setInterval(bump, interval);
      return () => clearInterval(timer);
    }
    let id = requestAnimationFrame(function frame() {
      bump();
      id = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(id);
  }, [active, interval]);
}

export function useSourceCapture(onConnected?: () => void) {
  const [pending, setPending] = useState<AudioSourceKind | null>(null);
  const connect = async (source: SourceOption) => {
    setPending(source.kind);
    const result = await source.capture();
    setPending(null);
    if (result.ok) onConnected?.();
    else showWarning(result.error);
  };
  return { pending, connect };
}

export function SourcePicker() {
  const { pending, connect } = useSourceCapture();
  return (
    <div className="space-y-2">
      <Label>Source</Label>
      <div className="grid grid-cols-2 gap-2">
        {SOURCES.map((source) => (
          <Button
            key={source.kind}
            variant={audio.source === source.kind ? 'default' : 'outline'}
            size="sm"
            disabled={!!pending || !!source.unsupported}
            title={source.unsupported}
            onClick={() => connect(source)}
          >
            <source.icon />
            {source.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function swatchStyle(palette: Palette) {
  if (palette.rainbow) return { background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' };
  const colors = palette.stops.map(([h, s, l]) => `hsl(${h} ${s}% ${l}%)`);
  return { background: `linear-gradient(90deg, ${colors.join(', ')})` };
}

export function IconTile({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-primary/15 text-primary">{children}</div>
  );
}

interface MeterBarProps {
  value: number;
  hot?: boolean;
  className?: string;
  fillClassName?: string;
}

export function MeterBar({ value, hot, className, fillClassName }: MeterBarProps) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)} aria-hidden>
      <div className={cn('h-full', fillClassName)} data-hot={hot} style={{ width: `${clamp01(value) * 100}%` }} />
    </div>
  );
}

function ChangeOnSelect({ triggerProps }: { triggerProps: ComponentProps<typeof SelectTrigger> }) {
  return (
    <Select
      value={currentChangeOn()}
      onValueChange={(value) => {
        const option = findChangeOption(value);
        if (option) setChangeOn(option.value);
      }}
    >
      <SelectTrigger {...triggerProps}>
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
  );
}

function TransitionSelect({ triggerProps }: { triggerProps: ComponentProps<typeof SelectTrigger> }) {
  return (
    <Select
      value={currentFolder()?.transition ?? DEFAULT_TRANSITION}
      onValueChange={(value) => {
        const option = findTransition(value);
        if (option) setTransition(option.value);
      }}
    >
      <SelectTrigger {...triggerProps}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TRANSITIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PlaybackOptions() {
  const changeId = useId();
  const transitionId = useId();
  const shuffleId = useId();
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={changeId} className="text-xs text-muted-foreground">
          Change scene
        </Label>
        <ChangeOnSelect triggerProps={{ id: changeId, size: 'sm', className: 'w-full' }} />
      </div>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={transitionId} className="text-xs text-muted-foreground">
          Transition
        </Label>
        <TransitionSelect triggerProps={{ id: transitionId, size: 'sm', className: 'w-full' }} />
      </div>
      <div className="col-span-2 flex items-center justify-between gap-3">
        <Label htmlFor={shuffleId}>Shuffle scene order</Label>
        <Switch id={shuffleId} checked={currentShuffle()} onCheckedChange={setShuffle} />
      </div>
    </div>
  );
}
