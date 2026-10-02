import { useEffect, useId, useState, type ComponentProps, type MouseEvent, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import type { AudioSourceKind } from '@/audio/sources';
import { showWarning } from '@/dom';
import { settings } from '@/state';
import type { TuningControl } from '@/tuning';
import { closeOverlay, menuParent, menuTrail, openMenuScreen, setSetting, type MenuScreen } from '@/actions';
import { hasOpenLayer, isMenuBackKey } from '@/controls';
import { currentFolder } from '@/presets/library';
import { currentChangeOn, currentShuffle, setChangeOn, setShuffle, setTransition } from '@/presets/playlist';
import { clamp01 } from '@/math';
import { ui, type Overlay } from '@/store';
import { cn } from '@/lib/utils';
import { CHANGE_OPTIONS, findChangeOption } from '@/presets/change';
import { DEFAULT_TRANSITION, findTransition, TRANSITIONS } from '@/effects/transition';
import { audio, listInputDevices, selectInputDevice } from '@/audio/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { Palette } from '@/palettes';
import { MENU_SCREEN_LABELS, SOURCES, type SourceOption } from './labels';
import { LiveCanvas } from './LiveCanvas';

export const FLOATING_PANEL = 'border-2 border-foreground bg-card shadow-hard';

export const SIDE_PANEL_WIDTH = 'sm:max-w-(--side-panel-width)';

const WAVE_WIDTH = 1200;
const WAVE_HEIGHT = 120;
const WAVE_POINTS = 480;

function waveformPath(width: number, height: number, points: number) {
  const mid = height / 2;
  const coords = Array.from({ length: points + 1 }, (_, index) => {
    const x = (index / points) * width;
    const envelope = 0.25 + 0.75 * Math.abs(Math.sin((x / width) * Math.PI * 2.6 + 0.4)) ** 1.6;
    const signal = Math.sin(x * 0.09) + 0.5 * Math.sin(x * 0.23 + 1) + 0.3 * Math.sin(x * 0.57 + 2);
    const y = mid - (signal / 1.8) * envelope * mid * 0.85;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return `M${coords.join('L')}`;
}

const WAVEFORM = waveformPath(WAVE_WIDTH, WAVE_HEIGHT, WAVE_POINTS);

const WAVE_BAND = 'absolute inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom,0px))] h-16 w-full text-foreground sm:h-24';

export function MenuBackdrop({ live = false }: { live?: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-0 bg-background" aria-hidden>
      {live ? (
        <LiveCanvas className={cn(WAVE_BAND, 'block')} />
      ) : (
        <svg viewBox={`0 0 ${WAVE_WIDTH} ${WAVE_HEIGHT}`} preserveAspectRatio="none" className={WAVE_BAND}>
          <path d={WAVEFORM} fill="none" stroke="currentColor" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </div>
  );
}

export function blurAfterPointerClick(event: MouseEvent) {
  if (!event.detail || !(event.target instanceof Element)) return;
  const control = event.target.closest('button, [role="button"]');
  if (control instanceof HTMLElement) control.blur();
}

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
    else if (result.error) showWarning(result.error);
  };
  return { pending, connect };
}

const DEFAULT_INPUT = 'default';

function useInputDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      listInputDevices().then(
        (list) => active && setDevices(list),
        () => {},
      );
    };
    refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh);
    return () => {
      active = false;
      navigator.mediaDevices?.removeEventListener?.('devicechange', refresh);
    };
  }, [audio.source]);
  return devices;
}

async function chooseInputDevice(value: string) {
  const result = await selectInputDevice(value === DEFAULT_INPUT ? '' : value);
  if (result?.error) showWarning(result.error);
}

export function InputDevicePicker({ className }: { className?: string }) {
  const id = useId();
  const devices = useInputDevices();
  if (!devices.length) return null;
  const value = devices.some((device) => device.deviceId === audio.inputDevice) ? audio.inputDevice : DEFAULT_INPUT;
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        Microphone input
      </Label>
      <Select value={value} onValueChange={chooseInputDevice}>
        <SelectTrigger id={id} size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_INPUT}>System default</SelectItem>
          {devices.map((device) => (
            <SelectItem key={device.deviceId} value={device.deviceId}>
              {device.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
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
      <InputDevicePicker className="pt-1" />
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
    <div className="mb-2 flex size-11 items-center justify-center rounded-md border border-foreground bg-live text-live-foreground">{children}</div>
  );
}

interface SliderRowProps extends Omit<ComponentProps<typeof Slider>, 'id' | 'value' | 'min' | 'max' | 'step' | 'onValueChange'> {
  control: TuningControl;
  display?: string;
  compact?: boolean;
  onValueChange?: (value: number) => void;
}

export function SliderRow({ control, display, compact, onValueChange, children, ...props }: SliderRowProps) {
  const { key, label, min, max, step, format, description } = control;
  const id = `tune-${key}`;
  return (
    <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id} title={compact ? description : undefined} className={cn(compact && 'text-xs font-normal')}>
          {label}
        </Label>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{display ?? format(settings[key])}</span>
      </div>
      <Slider
        id={id}
        value={[settings[key]]}
        min={min}
        max={max}
        step={step}
        onValueChange={([value]) => (onValueChange ?? ((next: number) => setSetting(key, next)))(value)}
        {...props}
      />
      {children}
      {!compact && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
    </div>
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
    <div className={cn('h-1.5 overflow-hidden rounded-xs bg-muted', className)} aria-hidden>
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

function useMenuBackKey(target: MenuScreen) {
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (!isMenuBackKey(event, hasOpenLayer())) return;
      event.preventDefault();
      openMenuScreen(target);
    };
    addEventListener('keydown', handle);
    return () => removeEventListener('keydown', handle);
  }, [target]);
}

function Breadcrumbs({ trail }: { trail: MenuScreen[] }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 max-sm:sr-only">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {trail.map((screen, index) => {
          const label = MENU_SCREEN_LABELS[screen];
          const current = index === trail.length - 1;
          return (
            <li key={screen} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />}
              {current ? (
                <span aria-current="page" className="truncate font-medium text-foreground">
                  {label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => openMenuScreen(screen)}
                  className="shrink-0 rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface MenuNavProps {
  screen: Exclude<MenuScreen, 'landing'>;
  width: string;
  actions?: ReactNode;
}

export function MenuNav({ screen, width, actions }: MenuNavProps) {
  const trail = menuTrail(screen, ui.liveMode);
  const parent = menuParent(screen, ui.liveMode) ?? 'landing';
  const parentLabel = MENU_SCREEN_LABELS[parent];
  useMenuBackKey(parent);

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-border bg-background pt-[env(safe-area-inset-top,0px)]">
      <div className={cn('mx-auto flex h-14 items-center gap-3 px-4 sm:px-6', width)}>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2.5 sm:-ml-2 sm:w-8 sm:has-[>svg]:px-0"
          aria-label={`Back to ${parentLabel}`}
          title={`Back to ${parentLabel}`}
          onClick={() => openMenuScreen(parent)}
        >
          <ArrowLeft />
          <span className="sm:sr-only">{parentLabel}</span>
        </Button>
        <Separator orientation="vertical" className="data-[orientation=vertical]:h-5 max-sm:hidden" />
        <Breadcrumbs trail={trail} />
        {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
