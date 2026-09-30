import type { ComponentProps } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { resetTuning, setGain, setSetting } from '@/actions';
import { audio } from '@/audio/input';
import { showWarning } from '@/dom';
import { settings, signal } from '@/state';
import { useEngine } from '@/store';
import { GAIN_CONTROL, TUNING_SECTIONS, type TuningControl } from '@/tuning';
import { SOURCES, TUNING_GROUP_NOTES } from './labels';
import { MeterBar, useOverlay, useTicker } from './shared';

const LIVE_INTERVAL = 150;

async function switchSource(capture: (typeof SOURCES)[number]['capture']) {
  const result = await capture();
  if (result.error) showWarning(result.error);
}

export function SourcePicker() {
  return (
    <div className="space-y-2">
      <Label>Source</Label>
      <div className="grid grid-cols-2 gap-2">
        {SOURCES.map((source) => (
          <Button
            key={source.kind}
            variant={audio.source === source.kind ? 'default' : 'outline'}
            size="sm"
            disabled={!!source.unsupported}
            title={source.unsupported}
            onClick={() => switchSource(source.capture)}
          >
            <source.icon />
            {source.label}
          </Button>
        ))}
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

function LevelMeter() {
  return (
    <MeterBar
      value={signal.energy}
      hot={signal.energy > 0.85}
      fillClassName="rounded-full bg-emerald-400 transition-[width] duration-150 data-[hot=true]:bg-amber-400"
    />
  );
}

function GainRows({ active }: { active: boolean }) {
  useTicker(active, LIVE_INTERVAL);
  const liveGain = signal.gainFactor;
  return (
    <>
      <SliderRow
        control={GAIN_CONTROL}
        display={`×${liveGain.toFixed(liveGain < 1 ? 2 : 1)}`}
        disabled={settings.autoGain}
        onValueChange={setGain}
      >
        <LevelMeter />
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
  const overlay = useOverlay('tuning');
  return (
    <Sheet {...overlay}>
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
                  <GainRows key={control.key} active={overlay.open} />
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
