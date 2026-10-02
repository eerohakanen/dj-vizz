import { closeOverlay } from '@/actions';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { modeKeyFor } from '@/controls';
import { setMode } from '@/mode';
import { MODE_GROUPS, MODES } from '@/modes/index';
import { settings } from '@/state';
import { useEngine } from '@/store';
import { cn } from '@/lib/utils';
import { useOverlay } from './shared';

function pickMode(index: number) {
  setMode(index);
  closeOverlay();
}

const indexedModes = MODES.map((mode, index) => ({ mode, index }));

const MODE_SECTIONS = MODE_GROUPS.map((group) => ({ group, modes: indexedModes.filter(({ mode }) => mode.group === group) }));

export function ModeLibrary() {
  useEngine();
  return (
    <Dialog {...useOverlay('modes')}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Modes</DialogTitle>
          <DialogDescription>Pick the visual that drives the show.</DialogDescription>
        </DialogHeader>
        <div className="-mx-2 max-h-[70vh] overflow-y-auto px-2 py-1">
          <div className="space-y-5">
            {MODE_SECTIONS.map(({ group, modes }) => (
              <section key={group} aria-labelledby={`mode-group-${group}`} className="space-y-2">
                <h3 id={`mode-group-${group}`} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {group}
                </h3>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {modes.map(({ mode, index }) => {
                    const active = index === settings.mode;
                    const key = modeKeyFor(index);
                    return (
                      <li key={mode.name}>
                        <button
                          type="button"
                          aria-current={active}
                          onClick={() => pickMode(index)}
                          className={cn(
                            'w-full rounded-lg border bg-background text-left transition-colors outline-none hover:border-foreground/40 focus-visible:ring-[3px] focus-visible:ring-ring',
                            active && 'border-primary ring-1 ring-primary',
                          )}
                        >
                          <div className="space-y-1 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{mode.name}</span>
                              {key && <Kbd>{key}</Kbd>}
                            </div>
                            <p className="text-sm text-muted-foreground">{mode.description}</p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
