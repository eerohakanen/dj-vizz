import { useEffect, useState } from 'react';
import {
  AudioLines,
  CircleHelp,
  FolderOpen,
  Maximize,
  MicIcon,
  MonitorSpeaker,
  Sparkles,
  Square,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { openOverlay, setGain, setMirror, setPsy, setSetting, toggleFullscreen } from '@/actions.js';
import { audio, captureMicrophone, captureWindow } from '@/audio/input.js';
import { setPalette } from '@/color.js';
import { showMessage } from '@/dom.js';
import { triggerDrop } from '@/events.js';
import { setMode } from '@/mode.js';
import { MODES } from '@/modes/index.js';
import { PALETTES } from '@/palettes.js';
import { currentFolder, playlist } from '@/presets/library.js';
import { togglePlayback } from '@/presets/playlist.js';
import { settings, signal } from '@/state.js';
import { ui, useEngine } from '@/store.js';
import { MIRROR_NAMES, PSY_NAMES } from '@/ui.js';
import { cn } from '@/lib/utils';
import { SOURCE_LABELS } from './labels.js';

const TOGGLES = [
  { key: 'trails', label: 'Trails', shortcut: 'E' },
  { key: 'lasers', label: 'Lasers', shortcut: 'L' },
  { key: 'glitch', label: 'Glitch', shortcut: 'X' },
  { key: 'strobe', label: 'Strobe', shortcut: 'S' },
];

function Hint({ label, shortcut, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-2 opacity-60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

function ModeSelect() {
  return (
    <Select value={String(settings.mode)} onValueChange={(value) => setMode(+value)}>
      <Hint label="Visual mode" shortcut="1–0, ← →">
        <SelectTrigger size="sm" className="w-36">
          <span className="text-muted-foreground">Mode</span>
          <SelectValue />
        </SelectTrigger>
      </Hint>
      <SelectContent position="popper" side="top" align="start" avoidCollisions={false} className="max-h-none">
        {MODES.map((mode, index) => (
          <SelectItem key={mode.name} value={String(index)}>
            {mode.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function swatchStyle(palette) {
  if (palette.rainbow) return { background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' };
  const colors = palette.stops.map(([h, s, l]) => `hsl(${h} ${s}% ${l}%)`);
  return { background: `linear-gradient(90deg, ${colors.join(', ')})` };
}

function PaletteSelect() {
  return (
    <Select value={String(settings.palette)} onValueChange={(value) => setPalette(+value, true)}>
      <Hint label="Colour palette" shortcut="C">
        <SelectTrigger size="sm" className="w-40">
          <SelectValue />
        </SelectTrigger>
      </Hint>
      <SelectContent position="popper" side="top" align="start" avoidCollisions={false} className="max-h-none">
        {PALETTES.map((palette, index) => (
          <SelectItem key={palette.name} value={String(index)}>
            <span className="size-3.5 shrink-0 rounded-full" style={swatchStyle(palette)} />
            {palette.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function activeEffectCount() {
  return TOGGLES.filter(({ key }) => settings[key]).length + (settings.psy > 0) + (settings.mirror > 0);
}

function EffectsMenu() {
  const count = activeEffectCount();
  return (
    <DropdownMenu>
      <Hint label="Effects">
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Sparkles />
            Effects
            {count > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1.5 tabular-nums">
                {count}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Psychedelic
            <span className="ml-auto text-xs text-muted-foreground">{PSY_NAMES[settings.psy]}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={String(settings.psy)} onValueChange={(value) => setPsy(+value)}>
              {PSY_NAMES.map((name, index) => (
                <DropdownMenuRadioItem key={name} value={String(index)} onSelect={(event) => event.preventDefault()}>
                  {name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Mirror
            <span className="ml-auto text-xs text-muted-foreground">{MIRROR_NAMES[settings.mirror]}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={String(settings.mirror)} onValueChange={(value) => setMirror(+value)}>
              {MIRROR_NAMES.map((name, index) => (
                <DropdownMenuRadioItem key={name} value={String(index)} onSelect={(event) => event.preventDefault()}>
                  {name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Layers</DropdownMenuLabel>
        {TOGGLES.map(({ key, label, shortcut }) => (
          <DropdownMenuCheckboxItem
            key={key}
            checked={settings[key]}
            onCheckedChange={(checked) => setSetting(key, checked)}
            onSelect={(event) => event.preventDefault()}
          >
            {label}
            <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={settings.auto}
          disabled={playlist.playing}
          onCheckedChange={(checked) => setSetting('auto', checked)}
          onSelect={(event) => event.preventDefault()}
        >
          Auto-switch on drops
          <DropdownMenuShortcut>A</DropdownMenuShortcut>
        </DropdownMenuCheckboxItem>
        {settings.strobe && (
          <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">Strobe flashes on beats. Avoid if sensitive to flashing light.</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function useLiveGain(active) {
  const [gain, setLiveGain] = useState(signal.gainFactor);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setLiveGain(signal.gainFactor), 150);
    return () => clearInterval(timer);
  }, [active]);
  return gain;
}

function SliderRow({ id, label, value, display, ...props }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{display}</span>
      </div>
      <Slider id={id} value={[value]} {...props} />
    </div>
  );
}

function AudioPopover() {
  const [open, setOpen] = useState(false);
  const liveGain = useLiveGain(open);

  const switchSource = async (capture) => {
    const result = await capture();
    if (result.error) showMessage(result.error);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Hint label="Audio input and levels">
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <span className={cn('size-2 rounded-full', audio.live ? 'bg-emerald-400' : 'bg-destructive')} />
            <AudioLines />
            {SOURCE_LABELS[audio.source] ?? 'No input'}
          </Button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent side="top" align="start" className="w-80 space-y-5">
        <div className="space-y-2">
          <Label>Source</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={audio.source === 'window' ? 'default' : 'outline'}
              size="sm"
              onClick={() => switchSource(captureWindow)}
            >
              <MonitorSpeaker />
              Window
            </Button>
            <Button
              variant={audio.source === 'mic' ? 'default' : 'outline'}
              size="sm"
              onClick={() => switchSource(captureMicrophone)}
            >
              <MicIcon />
              Microphone
            </Button>
          </div>
        </div>
        <Separator />
        <SliderRow
          id="gain"
          label="Gain"
          value={settings.gain}
          display={`×${liveGain.toFixed(liveGain < 1 ? 2 : 1)}`}
          min={0}
          max={100}
          step={1}
          disabled={settings.autoGain}
          onValueChange={([value]) => setGain(value)}
        />
        <div className="flex items-center justify-between">
          <Label htmlFor="auto-gain">
            Automatic gain <span className="text-xs text-muted-foreground">G</span>
          </Label>
          <Switch id="auto-gain" checked={settings.autoGain} onCheckedChange={(checked) => setSetting('autoGain', checked)} />
        </div>
        <SliderRow
          id="react"
          label="Reactivity"
          value={settings.reactivity}
          display={settings.reactivity.toFixed(1)}
          min={0.5}
          max={3}
          step={0.1}
          onValueChange={([value]) => setSetting('reactivity', value)}
        />
      </PopoverContent>
    </Popover>
  );
}

function PlaylistStatus() {
  if (!playlist.playing) return null;
  const folder = currentFolder();
  return (
    <Hint label="Stop playing folder">
      <Button variant="secondary" size="sm" onClick={togglePlayback}>
        <Square className="fill-current" />
        <span className="max-w-32 truncate">{folder.name}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {playlist.index + 1}/{folder.presets.length}
        </span>
      </Button>
    </Hint>
  );
}

export function Toolbar() {
  useEngine();
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 flex justify-center px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] transition-opacity duration-500',
        ui.controlsHidden && 'pointer-events-none opacity-0',
      )}
    >
      <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border bg-card/80 p-2 shadow-2xl backdrop-blur-xl">
        <AudioPopover />
        <Separator orientation="vertical" className="h-6! max-sm:hidden" />
        <ModeSelect />
        <PaletteSelect />
        <EffectsMenu />
        <Hint label="Fire a drop" shortcut="Enter">
          <Button variant="outline" size="sm" onClick={triggerDrop}>
            <Zap />
            Drop
          </Button>
        </Hint>
        <Separator orientation="vertical" className="h-6! max-sm:hidden" />
        <PlaylistStatus />
        <Hint label="Presets" shortcut="M">
          <Button size="sm" onClick={() => openOverlay('presets')}>
            <FolderOpen />
            Presets
          </Button>
        </Hint>
        <Hint label="Fullscreen" shortcut="F">
          <Button variant="ghost" size="icon-sm" onClick={toggleFullscreen} aria-label="Fullscreen">
            <Maximize />
          </Button>
        </Hint>
        <Hint label="Keyboard shortcuts" shortcut="?">
          <Button variant="ghost" size="icon-sm" onClick={() => openOverlay('help')} aria-label="Keyboard shortcuts">
            <CircleHelp />
          </Button>
        </Hint>
      </div>
    </div>
  );
}
