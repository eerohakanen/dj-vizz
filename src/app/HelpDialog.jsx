import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { closeOverlay } from '@/actions.js';
import { view } from '@/state.js';
import { ui, useEngine } from '@/store.js';

const SHORTCUTS = [
  [['1', '–', '0'], 'Pick a mode'],
  [['←', '→'], 'Previous / next mode'],
  [['C'], 'Next palette (Shift+C previous)'],
  [['P'], 'Cycle psychedelic effect'],
  [['K'], 'Cycle mirror'],
  [['L'], 'Lasers'],
  [['X'], 'Glitch'],
  [['S'], 'Strobe'],
  [['E'], 'Trails'],
  [['A'], 'Auto-switch on drops and every 32 beats'],
  [['Enter'], 'Fire a drop'],
  [['M'], 'Presets'],
  [['Space'], 'Next preset in folder'],
  [['↑', '↓'], 'Gain up / down'],
  [['G'], 'Automatic gain'],
  [['F'], 'Fullscreen'],
  [['H'], 'Hide / show controls'],
  [['Q'], 'Back to main menu'],
  [['?'], 'This help'],
];

export function HelpDialog() {
  useEngine();
  return (
    <Dialog
      open={ui.overlay === 'help'}
      onOpenChange={(open) => {
        if (!open) closeOverlay();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Render quality adapts automatically to stay smooth. Current: {Math.round(view.quality * 100)}%
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={label} className="contents">
              <dt>
                <KbdGroup>
                  {keys.map((key) => (key === '–' ? <span key={key}>–</span> : <Kbd key={key}>{key}</Kbd>))}
                </KbdGroup>
              </dt>
              <dd className="text-muted-foreground">{label}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
