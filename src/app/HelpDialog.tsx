import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { KEY_GROUPS, keysFor } from '@/controls';
import { view } from '@/state';
import { ui, useEngine } from '@/store';
import { useOverlay } from './shared';

export function HelpDialog() {
  useEngine();
  const keys = keysFor(ui.liveMode);
  const groups = KEY_GROUPS.map((group) => ({ group, entries: keys.filter((entry) => entry.group === group) })).filter(
    ({ entries }) => entries.length,
  );
  return (
    <Dialog {...useOverlay('help')}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Render quality adapts automatically to stay smooth. Current: {Math.round(view.quality * 100)}%
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {groups.map(({ group, entries }) => (
            <section key={group}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group}</h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                {entries.map((entry) => (
                  <div key={entry.id} className="contents">
                    <dt>
                      <KbdGroup>
                        {entry.display.map((key) => (
                          <Kbd key={key}>{key}</Kbd>
                        ))}
                      </KbdGroup>
                    </dt>
                    <dd className="text-muted-foreground">{entry.help}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
