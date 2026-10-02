import { useState, type ReactNode } from 'react';
import {
  AudioLines,
  CircleHelp,
  EyeOff,
  Layers,
  ListMusic,
  LogOut,
  Maximize,
  Minimize,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Save,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  fullscreenSupported,
  newPreset,
  nextScene,
  openOverlay,
  openPresets,
  previousScene,
  setHideLocked,
  setMirror,
  setPixelate,
  setPsy,
  setSetting,
  switchToEdit,
  switchToPlay,
  toggleFullscreen,
  togglePaused,
} from '@/actions';
import { audio } from '@/audio/input';
import { setPalette } from '@/color';
import { shortcutFor, shortcutKeys } from '@/controls';
import { triggerDrop } from '@/events';
import { pixelateAvailable, setMode } from '@/mode';
import { MODES } from '@/modes/index';
import { PALETTES } from '@/palettes';
import { currentFolder, playlist } from '@/presets/library';
import { showMessage } from '@/dom';
import { settings } from '@/state';
import { ui, useEngine } from '@/store';
import { MIRROR_NAMES, PIXEL_NAMES, PSY_NAMES } from '@/effects/options';
import { EFFECT_CONTROLS } from '@/tuning';
import { cn } from '@/lib/utils';
import { SOURCES, sourceLabel } from './labels';
import { FLOATING_PANEL, SliderRow, SourcePicker, swatchStyle } from './shared';
import { StableLabel } from './StableLabel';

const NO_INPUT_LABEL = 'No input';
const AUDIO_LABELS = [...SOURCES.map((source) => source.label), NO_INPUT_LABEL];

const TOGGLES = [
  { key: 'lasers', label: 'Lasers' },
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
            <span className="size-3.5 shrink-0 rounded-xs" style={swatchStyle(palette)} />
            {palette.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const EFFECT_HEADING = 'text-xs font-medium uppercase tracking-wide text-muted-foreground';

function EffectLabel({ htmlFor, label, shortcut }: { htmlFor: string; label: string; shortcut: string }) {
  return (
    <Label htmlFor={htmlFor} className="min-w-0 flex-1">
      {label}
      <span className="text-xs font-normal text-muted-foreground">{shortcut}</span>
    </Label>
  );
}

interface EffectRowProps {
  id: string;
  label: string;
  shortcut: string;
  control: ReactNode;
  children?: ReactNode;
}

function EffectRow({ id, label, shortcut, control, children }: EffectRowProps) {
  return (
    <div className="space-y-3 py-2.5">
      <div className="flex min-h-8 items-center gap-3">
        <EffectLabel htmlFor={id} label={label} shortcut={shortcut} />
        {control}
      </div>
      {children && <div className="space-y-3 border-l-2 border-foreground pl-3">{children}</div>}
    </div>
  );
}

interface EffectSelectProps {
  id: string;
  names: readonly string[];
  value: number;
  onChange: (index: number) => void;
  unavailable?: string;
}

function EffectSelect({ id, names, value, onChange, unavailable }: EffectSelectProps) {
  return (
    <Select value={String(value)} onValueChange={(next) => onChange(+next)} disabled={!!unavailable}>
      <SelectTrigger id={id} size="sm" className="w-32">
        {unavailable ? <span className="text-muted-foreground">{unavailable}</span> : <SelectValue />}
      </SelectTrigger>
      <SelectContent position="popper" side="top" align="end">
        {names.map((name, index) => (
          <SelectItem key={name} value={String(index)}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const pixelateOn = () => settings.pixelate > 0 && pixelateAvailable();

function activeEffectCount() {
  return TOGGLES.filter(({ key }) => settings[key]).length + Number(settings.psy > 0) + Number(settings.mirror > 0) + Number(pixelateOn());
}

function EffectsMenu() {
  const count = activeEffectCount();
  return (
    <Popover>
      <Hint label="Effects">
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Sparkles />
            Effects
            <Badge
              variant="secondary"
              className={cn('h-5 min-w-5 rounded-sm px-1.5 font-mono tabular-nums', count === 0 && 'invisible')}
              aria-hidden={count === 0}
            >
              {count}
            </Badge>
          </Button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent
        side="top"
        align="start"
        className="max-h-[calc(100dvh-6rem)] w-80 overflow-y-auto py-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <section aria-labelledby="effects-look" className="divide-y divide-border">
          <h3 id="effects-look" className={cn(EFFECT_HEADING, 'pb-1')}>
            Look
          </h3>
          <EffectRow
            id="effect-psy"
            label="Psychedelic"
            shortcut={shortcutFor('psy')}
            control={<EffectSelect id="effect-psy" names={PSY_NAMES} value={settings.psy} onChange={setPsy} />}
          />
          <EffectRow
            id="effect-mirror"
            label="Mirror"
            shortcut={shortcutFor('mirror')}
            control={<EffectSelect id="effect-mirror" names={MIRROR_NAMES} value={settings.mirror} onChange={setMirror} />}
          />
          <EffectRow
            id="effect-pixelate"
            label="Pixelate"
            shortcut={shortcutFor('pixelate')}
            control={
              <EffectSelect
                id="effect-pixelate"
                names={PIXEL_NAMES}
                value={settings.pixelate}
                onChange={setPixelate}
                unavailable={pixelateAvailable() ? undefined : 'Not in 3D'}
              />
            }
          >
            {pixelateOn() && (
              <>
                <SliderRow compact control={EFFECT_CONTROLS.pixelSize} />
                <SliderRow compact control={EFFECT_CONTROLS.pixelGap} />
              </>
            )}
          </EffectRow>
        </section>
        <section aria-labelledby="effects-layers" className="mt-3 divide-y divide-border">
          <h3 id="effects-layers" className={cn(EFFECT_HEADING, 'pb-1')}>
            Layers
          </h3>
          {TOGGLES.map(({ key, label }) => (
            <EffectRow
              key={key}
              id={`effect-${key}`}
              label={label}
              shortcut={shortcutFor(key)}
              control={<Switch id={`effect-${key}`} checked={settings[key]} onCheckedChange={(checked) => setSetting(key, checked)} />}
            >
            </EffectRow>
          ))}
        </section>
        {ui.liveMode === 'explore' && (
          <>
            <Separator className="my-2" />
            <EffectRow
              id="effect-auto"
              label="Auto-switch on drops"
              shortcut={shortcutFor('auto')}
              control={<Switch id="effect-auto" checked={settings.auto} onCheckedChange={(checked) => setSetting('auto', checked)} />}
            />
          </>
        )}
      </PopoverContent>
    </Popover>
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
            <span className={cn('size-2 rounded-full', audio.live ? 'bg-brand' : 'bg-destructive')} />
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
        {ui.liveMode === 'explore' ? (
          <DropdownMenuItem onSelect={() => openOverlay('exit')}>
            <LogOut />
            Exit
            <DropdownMenuShortcut>{shortcutFor('exit')}</DropdownMenuShortcut>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={openPresets}>
            <ListMusic />
            Presets menu
            <DropdownMenuShortcut>{shortcutFor('menu')}</DropdownMenuShortcut>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PauseButton({ className }: { className?: string }) {
  return (
    <Hint label={ui.paused ? 'Resume visuals' : 'Pause visuals'} shortcut={shortcutFor('pause')}>
      <Button variant={ui.paused ? 'default' : 'outline'} size="sm" className={className} onClick={togglePaused} aria-pressed={ui.paused}>
        {ui.paused ? <Play /> : <Pause />}
        <StableLabel value={ui.paused ? 'Resume' : 'Pause'} options={['Pause', 'Resume']} />
      </Button>
    </Hint>
  );
}

function ViewButtons({ showHideOnMobile }: { showHideOnMobile?: boolean }) {
  return (
    <>
      <FullscreenButton />
      <Hint label="Keyboard shortcuts" shortcut={shortcutFor('help')}>
        <Button variant="ghost" size="icon-sm" className="max-sm:hidden" onClick={() => openOverlay('help')} aria-label="Keyboard shortcuts">
          <CircleHelp />
        </Button>
      </Hint>
      <Hint label="Hide controls" shortcut={shortcutFor('hide')}>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(!showHideOnMobile && 'max-sm:hidden')}
          onClick={() => setHideLocked(true)}
          aria-label="Hide controls"
        >
          <EyeOff />
        </Button>
      </Hint>
    </>
  );
}

function MenuButton({ labelled }: { labelled?: boolean }) {
  return (
    <Hint label="Back to presets menu" shortcut={shortcutFor('menu')}>
      {labelled ? (
        <Button variant="outline" size="sm" onClick={openPresets}>
          <ListMusic />
          Menu
        </Button>
      ) : (
        <Button variant="ghost" size="icon-sm" className="max-sm:hidden" onClick={openPresets} aria-label="Presets menu">
          <ListMusic />
        </Button>
      )}
    </Hint>
  );
}

function ExitButton() {
  return (
    <Hint label="Back to main menu" shortcut={shortcutFor('exit')}>
      <Button variant="ghost" size="icon-sm" className="max-sm:hidden" onClick={() => openOverlay('exit')} aria-label="Back to main menu">
        <LogOut />
      </Button>
    </Hint>
  );
}

function saveAsPreset() {
  newPreset();
  showMessage(`Saved as "${currentFolder()?.name}". Keep tweaking, or add more scenes.`);
}

function ExploreActions() {
  return (
    <Hint label="Save these visuals as the first scene of a new preset">
      <Button size="sm" onClick={saveAsPreset}>
        <Save />
        Save as preset
      </Button>
    </Hint>
  );
}

function EditActions() {
  const open = ui.overlay === 'scenes';
  const count = currentFolder()?.presets.length ?? 0;
  return (
    <>
      <Hint label={open ? 'Hide scene list' : 'Show scene list'} shortcut={shortcutFor('scenes')}>
        <Button variant={open ? 'secondary' : 'outline'} size="sm" onClick={() => openOverlay('scenes')} aria-pressed={open}>
          <Layers />
          Scenes
          <Badge variant="secondary" className="h-5 min-w-5 rounded-sm px-1.5 font-mono tabular-nums">
            {count}
          </Badge>
        </Button>
      </Hint>
      <Hint label={count ? 'Play this preset' : 'Add a scene to play'}>
        <Button size="sm" disabled={!count} onClick={switchToPlay}>
          <Play />
          Play
        </Button>
      </Hint>
    </>
  );
}

function StudioControls() {
  const editing = ui.liveMode === 'edit';
  return (
    <>
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
      <PauseButton className="max-sm:hidden" />
      <Separator orientation="vertical" className="h-6! max-sm:hidden" />
      {editing ? <EditActions /> : <ExploreActions />}
      <MoreMenu />
      <ViewButtons />
      <Separator orientation="vertical" className="h-6! max-sm:hidden" />
      {editing ? <MenuButton /> : <ExitButton />}
    </>
  );
}

function NowPlaying() {
  const folder = currentFolder();
  const count = folder?.presets.length ?? 0;
  const scene = folder?.presets[playlist.index];
  return (
    <div className="flex min-w-0 max-w-48 flex-col px-2 leading-tight">
      <span className="truncate text-sm font-medium">{folder?.name}</span>
      <span className="truncate text-xs text-muted-foreground">
        {scene ? (
          <>
            <span className="font-mono tabular-nums">
              {playlist.index + 1}/{count}
            </span>{' '}
            · {scene.name}
          </>
        ) : (
          'Not playing'
        )}
      </span>
    </div>
  );
}

function PlayControls() {
  const stepDisabled = !playlist.playing || (currentFolder()?.presets.length ?? 0) < 2;
  const [previousKey, nextKey] = shortcutKeys('sceneStep');
  return (
    <>
      <NowPlaying />
      <Separator orientation="vertical" className="h-6!" />
      <Hint label="Previous scene" shortcut={previousKey}>
        <Button variant="outline" size="icon-sm" disabled={stepDisabled} onClick={previousScene} aria-label="Previous scene">
          <SkipBack />
        </Button>
      </Hint>
      <Hint label="Next scene" shortcut={`${nextKey}, ${shortcutFor('sceneNext')}`}>
        <Button variant="outline" size="icon-sm" disabled={stepDisabled} onClick={nextScene} aria-label="Next scene">
          <SkipForward />
        </Button>
      </Hint>
      <PauseButton />
      <Separator orientation="vertical" className="h-6! max-sm:hidden" />
      <Hint label="Edit this preset" shortcut={shortcutFor('edit')}>
        <Button variant="outline" size="sm" onClick={switchToEdit}>
          <Pencil />
          Edit
        </Button>
      </Hint>
      <MenuButton labelled />
      <ViewButtons showHideOnMobile />
    </>
  );
}

const SIDE_PANELS = new Set(['scenes', 'tuning']);

export function Toolbar() {
  useEngine();
  const sidePanelOpen = SIDE_PANELS.has(ui.overlay ?? '');
  return (
    <div
      data-toolbar
      inert={ui.controlsHidden}
      aria-hidden={ui.controlsHidden}
      className={cn(
        'fixed inset-x-0 bottom-0 flex justify-center px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] transition-[opacity,padding] duration-500',
        sidePanelOpen && 'sm:pr-[calc(var(--side-panel-width)+0.75rem)]',
        ui.controlsHidden && 'pointer-events-none opacity-0',
      )}
    >
      <div className={cn('flex max-w-full flex-wrap items-center justify-center gap-2 rounded-lg border p-2', FLOATING_PANEL)}>
        {ui.liveMode === 'play' ? <PlayControls /> : <StudioControls />}
      </div>
    </div>
  );
}
