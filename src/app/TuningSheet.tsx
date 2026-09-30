import { useEffect, useState, type ComponentProps } from 'react';
import { MicIcon, MonitorSpeaker, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { closeOverlay, resetTuning, setGain, setSetting } from '@/actions';
import { audio, canCaptureWindow, captureMicrophone, captureWindow } from '@/audio/input';
import { showWarning } from '@/dom';
import { settings, signal } from '@/state';
import { ui, useEngine } from '@/store';
import { GAIN_CONTROL, TUNING_SECTIONS, type TuningControl } from '@/tuning';
import { TUNING_GROUP_NOTES } from './labels';

function useLiveValue(read: () => number, active: boolean) {
  const [value, setValue] = useState(read);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setValue(read()), 150);
    return () => clearInterval(timer);
  }, [active, read]);
  return value;
}

const readGainFactor = () => signal.gainFactor;
const readEnergy = () => signal.energy;

async function switchSource(capture: typeof captureWindow) {
  const result = await capture();
  if (result.error) showWarning(result.error);
}

export function SourcePicker() {
  return (
    <div className="space-y-2">
      <Label>Source</Label>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={audio.source === 'window' ? 'default' : 'outline'}
          size="sm"
          disabled={!canCaptureWindow}
          title={canCaptureWindow ? undefined : 'Not supported on mobile browsers'}
          onClick={() => switchSource(captureWindow)}
        >
          <MonitorSpeaker />
          Window
        </Button>
        <Button variant={audio.source === 'mic' ? 'default' : 'outline'} size="sm" onClick={() => switchSource(captureMicrophone)}>
          <MicIcon />
          Microphone
        </Button>
      </div>
    </div>
  );
}

interface SliderRowProps extends Omit<ComponentProps<typeof Slider>, 'id' | 'value' | 'min' | 'max' | 'step' | 'onValueChange'> {
  control: TuningControl;
  display?: string;
  onValueChange?: (value: number) => void;
}

function SliderRow({ control, display, onValueChange, children, ...props }: SliderRowProps) {
  const { key, label, min, max, step, format, description } = control;
  const id = `tune-${key}`;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{display ?? format(settings[key])}</span>
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
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function LevelMeter({ active }: { active: boolean }) {
  const energy = useLiveValue(readEnergy, active);
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
      <div
        className="h-full rounded-full bg-emerald-400 transition-[width] duration-150 data-[hot=true]:bg-amber-400"
        data-hot={energy > 0.85}
        style={{ width: `${Math.min(100, energy * 100)}%` }}
      />
    </div>
  );
}

function GainRows({ active }: { active: boolean }) {
  const liveGain = useLiveValue(readGainFactor, active);
  return (
    <>
      <SliderRow
        control={GAIN_CONTROL}
        display={`×${liveGain.toFixed(liveGain < 1 ? 2 : 1)}`}
        disabled={settings.autoGain}
        onValueChange={setGain}
      >
        <LevelMeter active={active} />
      </SliderRow>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="auto-gain">
            Auto level <span className="text-xs text-muted-foreground">G</span>
          </Label>
          <Switch id="auto-gain" checked={settings.autoGain} onCheckedChange={(checked) => setSetting('autoGain', checked)} />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Keeps the input level steady so quiet and loud tracks both drive the visuals. Turn it off to set Input level by hand.
        </p>
      </div>
    </>
  );
}

export function TuningSheet() {
  useEngine();
  const open = ui.overlay === 'tuning';
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeOverlay();
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Tune</SheetTitle>
          <SheetDescription>Adjust what the visualizer hears and how strongly it reacts.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-4">
          {TUNING_SECTIONS.map((section, index) => (
            <section key={section.title} className="space-y-5">
              {index > 0 && <Separator />}
              <div>
                <h3 className="text-sm font-semibold">{section.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {section.description} {TUNING_GROUP_NOTES[section.group]}
                </p>
              </div>
              {index === 0 && <SourcePicker />}
              {section.controls.map((control) =>
                control === GAIN_CONTROL ? (
                  <GainRows key={control.key} active={open} />
                ) : (
                  <SliderRow key={control.key} control={control} />
                ),
              )}
            </section>
          ))}
        </div>
        <Separator />
        <SheetFooter>
          <Button variant="outline" onClick={resetTuning}>
            <RotateCcw />
            Reset to defaults
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
