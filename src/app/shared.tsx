import { useEffect, useId, useState, type ComponentProps, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { AudioSourceKind } from '@/audio/sources';
import { showWarning } from '@/dom';
import { closeOverlay } from '@/actions';
import { library, playlist } from '@/presets/library';
import { setChangeOn, setShuffle } from '@/presets/playlist';
import { clamp01 } from '@/math';
import { ui, type Overlay } from '@/store';
import { cn, pluralize } from '@/lib/utils';
import { CHANGE_OPTIONS, findChangeOption } from '@/presets/change';
import type { SourceOption } from './labels';

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

interface FolderSelectProps {
  value: number;
  onChange: (index: number) => void;
  className?: string;
  verbose?: boolean;
}

export function FolderSelect({ value, onChange, className, verbose }: FolderSelectProps) {
  return (
    <Select value={String(value)} onValueChange={(next) => onChange(+next)}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {library.folders.map((folder, index) => (
          <SelectItem key={index} value={String(index)}>
            {folder.name} · {verbose ? pluralize(folder.presets.length, 'preset') : folder.presets.length}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ChangeOnSelect({ triggerProps }: { triggerProps: ComponentProps<typeof SelectTrigger> }) {
  return (
    <Select value={playlist.changeOn} onValueChange={(value) => {
        const option = findChangeOption(value);
        if (option) setChangeOn(option.value);
      }}>
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

export function PlaybackOptions({ compact }: { compact?: boolean }) {
  const shuffleId = useId();
  const shuffle = <Switch id={shuffleId} checked={playlist.shuffle} onCheckedChange={setShuffle} />;

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <Label className="shrink-0">Change look</Label>
        <ChangeOnSelect triggerProps={{ size: 'sm', className: 'flex-1' }} />
        <Label htmlFor={shuffleId} className="shrink-0">
          Shuffle
        </Label>
        {shuffle}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <Label>Change look</Label>
        <ChangeOnSelect triggerProps={{ className: 'w-full' }} />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor={shuffleId}>Shuffle</Label>
        {shuffle}
      </div>
    </>
  );
}
