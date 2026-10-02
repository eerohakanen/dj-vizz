import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { resetModeTuning, resetTuning, setGain, setSetting } from '@/actions';
import { shortcutFor } from '@/controls';
import { currentMode } from '@/mode';
import { settings, signal } from '@/state';
import { ui, useEngine } from '@/store';
import { GAIN_CONTROL, tuningSectionsFor } from '@/tuning';
import { TUNING_GROUP_NOTES } from './labels';
import { cn } from '@/lib/utils';
import { blurAfterPointerClick, FLOATING_PANEL, SIDE_PANEL_WIDTH, MeterBar, SliderRow, SourcePicker, useOverlay, useTicker } from './shared';

const LIVE_INTERVAL = 150;

function LevelMeter() {
  return (
    <MeterBar
      value={signal.energy}
      hot={signal.energy > 0.85}
      fillClassName="rounded-xs bg-brand transition-[width] duration-150 data-[hot=true]:bg-destructive"
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
            Auto level <span className="text-xs text-muted-foreground">{shortcutFor('autoGain')}</span>
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
  const playing = ui.liveMode === 'play';
  const modeName = currentMode().name;
  return (
    <Sheet {...overlay} modal={false}>
      <SheetContent
        data-side-panel
        overlay={false}
        onClick={blurAfterPointerClick}
        onInteractOutside={(event) => event.preventDefault()}
        className={cn(FLOATING_PANEL, 'flex w-full flex-col gap-0', SIDE_PANEL_WIDTH)}
      >
        <SheetHeader>
          <SheetTitle>Tune</SheetTitle>
          <SheetDescription>
            {playing ? 'Adjust what the visualizer hears.' : 'Adjust what the visualizer hears and how strongly it reacts.'}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-4">
          {tuningSectionsFor(ui.liveMode).map((section, index) => (
            <section key={section.title} className="space-y-5">
              {index > 0 && <Separator />}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{section.group === 'mode' ? modeName : section.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {section.description} {TUNING_GROUP_NOTES[section.group]}
                  </p>
                </div>
                {section.group === 'mode' && (
                  <Button variant="ghost" size="xs" onClick={resetModeTuning} aria-label={`Reset ${modeName}`}>
                    <RotateCcw />
                    Reset
                  </Button>
                )}
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
        {!playing && (
          <>
            <Separator />
            <SheetFooter>
              <Button variant="outline" onClick={resetTuning}>
                <RotateCcw />
                Reset to defaults
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
