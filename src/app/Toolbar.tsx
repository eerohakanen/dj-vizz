import { useState, type ReactNode } from 'react';
import {
  AudioLines,
  CircleHelp,
  EyeOff,
  FolderOpen,
  LogOut,
  Maximize,
  Minimize,
  MoreHorizontal,
  Pause,
  Play,
  SlidersHorizontal,
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
  DropdownMenuItem,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { effectEnabled, strobeActive } from '@/motion';
import { fullscreenSupported, openOverlay, setMirror, setPsy, setHideLocked, setSetting, toggleFullscreen, togglePaused } from '@/actions';
import { audio } from '@/audio/input';
import { setPalette } from '@/color';
import { shortcutFor } from '@/controls';
import { triggerDrop } from '@/events';
import { setMode } from '@/mode';
import { MODES } from '@/modes/index';
import { PALETTES, type Palette } from '@/palettes';
import { currentFolder, playlist } from '@/presets/library';
import { togglePlayback } from '@/presets/playlist';
import { settings } from '@/state';
import { ui, useEngine } from '@/store';
import { MIRROR_NAMES, PSY_NAMES } from '@/effects/options';
import { cn } from '@/lib/utils';
import { SOURCES, sourceLabel } from './labels';
import { GLASS_PANEL, SourcePicker } from './shared';
import { StableLabel } from './StableLabel';

const NO_INPUT_LABEL = 'No input';
const AUDIO_LABELS = [...SOURCES.map((source) => source.label), NO_INPUT_LABEL];

const TOGGLES = [
  { key: 'trails', label: 'Trails' },
  { key: 'lasers', label: 'Lasers' },
  { key: 'glitch', label: 'Glitch' },
  { key: 'strobe', label: 'Strobe' },
] as const;

function Hint({ label, shortcut, children }: { label: string; shortcut?: string; children: ReactNode }) {
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
      <Hint label="Visual mode" shortcut={`${shortcutFor('mode')}, ${shortcutFor('modeStep')}`}>
        <SelectTrigger size="sm" className="w-36">
          <span className="text-muted-foreground">Mode</span>
          <SelectValue />
        </SelectTrigger>
      </Hint>
      <SelectContent position="popper" side="top" align="start">
        {MODES.map((mode, index) => (
          <SelectItem key={mode.name} value={String(index)}>
            {mode.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function swatchStyle(palette: Palette) {
  if (palette.rainbow) return { background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' };
  const colors = palette.stops.map(([h, s, l]) => `hsl(${h} ${s}% ${l}%)`);
  return { background: `linear-gradient(90deg, ${colors.join(', ')})` };
}

function PaletteSelect() {
  return (
    <Select value={String(settings.palette)} onValueChange={(value) => setPalette(+value, true)}>
      <Hint label="Colour palette" shortcut={shortcutFor('palette')}>
        <SelectTrigger size="sm" className="w-40">
          <SelectValue />
        </SelectTrigger>
      </Hint>
      <SelectContent position="popper" side="top" align="start">
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

interface OptionSubmenuProps {
  label: string;
  shortcut: string;
  names: readonly string[];
  value: number;
  onChange: (index: number) => void;
}

function OptionSubmenu({ label, shortcut, names, value, onChange }: OptionSubmenuProps) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        {label}
        <span className="ml-auto text-xs text-muted-foreground">{names[value]}</span>
        <DropdownMenuShortcut className="ml-2">{shortcut}</DropdownMenuShortcut>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={String(value)} onValueChange={(next) => onChange(+next)}>
          {names.map((name, index) => (
            <DropdownMenuRadioItem key={name} value={String(index)} onSelect={(event) => event.preventDefault()}>
              {name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function activeEffectCount() {
  return TOGGLES.filter(({ key }) => effectEnabled(key)).length + Number(settings.psy > 0) + Number(settings.mirror > 0);
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
            <Badge
              variant="secondary"
              className={cn('h-5 min-w-5 rounded-full px-1.5 tabular-nums', count === 0 && 'invisible')}
              aria-hidden={count === 0}
            >
              {count}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <OptionSubmenu label="Psychedelic" shortcut={shortcutFor('psy')} names={PSY_NAMES} value={settings.psy} onChange={setPsy} />
        <OptionSubmenu label="Mirror" shortcut={shortcutFor('mirror')} names={MIRROR_NAMES} value={settings.mirror} onChange={setMirror} />
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Layers</DropdownMenuLabel>
        {TOGGLES.map(({ key, label }) => (
          <DropdownMenuCheckboxItem
            key={key}
            checked={effectEnabled(key)}
            onCheckedChange={(checked) => setSetting(key, checked)}
            onSelect={(event) => event.preventDefault()}
          >
            {label}
            <DropdownMenuShortcut>{shortcutFor(key)}</DropdownMenuShortcut>
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
          <DropdownMenuShortcut>{shortcutFor('auto')}</DropdownMenuShortcut>
        </DropdownMenuCheckboxItem>
        {strobeActive() && (
          <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">Strobe flashes on beats. Avoid if sensitive to flashing light.</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AudioPopover() {
  const [open, setOpen] = useState(false);

  const openTuning = () => {
    setOpen(false);
    openOverlay('tuning');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Hint label="Audio input">
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <span className={cn('size-2 rounded-full', audio.live ? 'bg-emerald-400' : 'bg-destructive')} />
            <AudioLines />
            <StableLabel value={sourceLabel(audio.source) ?? NO_INPUT_LABEL} options={AUDIO_LABELS} />
          </Button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent side="top" align="start" className="w-80 space-y-4">
        <SourcePicker />
        <Separator />
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={openTuning}>
          <SlidersHorizontal />
          Adjust levels and sensitivity…
        </Button>
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

const FULLSCREEN_UNSUPPORTED = 'Fullscreen is not supported on this device';

function FullscreenButton() {
  const supported = fullscreenSupported();
  const label = ui.fullscreen ? 'Exit fullscreen' : 'Fullscreen';
  const button = (
    <Button
      variant="ghost"
      size="icon-sm"
      className="max-sm:hidden"
      onClick={toggleFullscreen}
      disabled={!supported}
      aria-label={label}
    >
      {ui.fullscreen ? <Minimize /> : <Maximize />}
    </Button>
  );
  if (supported) return <Hint label={label} shortcut={shortcutFor('fullscreen')}>{button}</Hint>;
  return (
    <Hint label={FULLSCREEN_UNSUPPORTED}>
      <span tabIndex={0} className="max-sm:hidden">
        {button}
      </span>
    </Hint>
  );
}

function MoreMenu() {
  const supported = fullscreenSupported();
  return (
    <DropdownMenu>
      <Hint label="More">
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" className="sm:hidden" aria-label="More">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent side="top" align="end" className="w-56">
        <DropdownMenuItem onSelect={() => openOverlay('tuning')}>
          <SlidersHorizontal />
          Tune
          <DropdownMenuShortcut>{shortcutFor('tune')}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={triggerDrop}>
          <Zap />
          Drop
          <DropdownMenuShortcut>{shortcutFor('drop')}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={togglePaused}>
          {ui.paused ? <Play /> : <Pause />}
          {ui.paused ? 'Resume' : 'Pause'}
          <DropdownMenuShortcut>{shortcutFor('pause')}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggleFullscreen} disabled={!supported}>
          {ui.fullscreen ? <Minimize /> : <Maximize />}
          {supported ? (ui.fullscreen ? 'Exit fullscreen' : 'Fullscreen') : 'Fullscreen unsupported'}
          <DropdownMenuShortcut>{shortcutFor('fullscreen')}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openOverlay('help')}>
          <CircleHelp />
          Keyboard shortcuts
          <DropdownMenuShortcut>{shortcutFor('help')}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setHideLocked(true)}>
          <EyeOff />
          Hide controls
          <DropdownMenuShortcut>{shortcutFor('hide')}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openOverlay('exit')}>
          <LogOut />
          Exit
          <DropdownMenuShortcut>{shortcutFor('exit')}</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Toolbar() {
  useEngine();
  return (
    <div
      data-toolbar
      inert={ui.controlsHidden}
      aria-hidden={ui.controlsHidden}
      className={cn(
        'fixed inset-x-0 bottom-0 flex justify-center px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] transition-opacity duration-500',
        ui.controlsHidden && 'pointer-events-none opacity-0',
      )}
    >
      <div className={cn('flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border p-2', GLASS_PANEL)}>
        <AudioPopover />
        <Separator orientation="vertical" className="h-6! max-sm:hidden" />
        <ModeSelect />
        <PaletteSelect />
        <EffectsMenu />
        <Hint label="Tune levels and effect strength" shortcut={shortcutFor('tune')}>
          <Button variant="outline" size="sm" className="max-sm:hidden" onClick={() => openOverlay('tuning')}>
            <SlidersHorizontal />
            Tune
          </Button>
        </Hint>
        <Hint label="Fire a drop" shortcut={shortcutFor('drop')}>
          <Button variant="outline" size="sm" className="max-sm:hidden" onClick={triggerDrop}>
            <Zap />
            Drop
          </Button>
        </Hint>
        <Hint label={ui.paused ? 'Resume visuals' : 'Pause visuals'} shortcut={shortcutFor('pause')}>
          <Button
            variant={ui.paused ? 'default' : 'outline'}
            size="sm"
            className="max-sm:hidden"
            onClick={togglePaused}
            aria-pressed={ui.paused}
          >
            {ui.paused ? <Play /> : <Pause />}
            <StableLabel value={ui.paused ? 'Resume' : 'Pause'} options={['Pause', 'Resume']} />
          </Button>
        </Hint>
        <Separator orientation="vertical" className="h-6! max-sm:hidden" />
        <PlaylistStatus />
        <Hint label="Presets" shortcut={shortcutFor('presets')}>
          <Button size="sm" onClick={() => openOverlay('presets')}>
            <FolderOpen />
            Presets
          </Button>
        </Hint>
        <MoreMenu />
        <FullscreenButton />
        <Hint label="Keyboard shortcuts" shortcut={shortcutFor('help')}>
          <Button variant="ghost" size="icon-sm" className="max-sm:hidden" onClick={() => openOverlay('help')} aria-label="Keyboard shortcuts">
            <CircleHelp />
          </Button>
        </Hint>
        <Hint label="Hide controls" shortcut={shortcutFor('hide')}>
          <Button variant="ghost" size="icon-sm" className="max-sm:hidden" onClick={() => setHideLocked(true)} aria-label="Hide controls">
            <EyeOff />
          </Button>
        </Hint>
        <Separator orientation="vertical" className="h-6! max-sm:hidden" />
        <Hint label="Back to main menu" shortcut={shortcutFor('exit')}>
          <Button variant="ghost" size="icon-sm" className="max-sm:hidden" onClick={() => openOverlay('exit')} aria-label="Back to main menu">
            <LogOut />
          </Button>
        </Hint>
      </div>
    </div>
  );
}
