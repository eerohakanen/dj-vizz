import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { setHideLocked } from '@/actions';
import { ui, useEngine } from '@/store';
import { cn } from '@/lib/utils';
import { FLOATING_PANEL } from './shared';

export function RevealButton() {
  useEngine();
  const visible = ui.hideLocked && ui.peek;
  return (
    <div
      className={cn(
        'fixed top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 transition-opacity duration-500',
        !visible && 'pointer-events-none opacity-0',
      )}
      aria-hidden={!visible}
    >
      <Button
        data-reveal
        variant="outline"
        size="sm"
        tabIndex={visible ? 0 : -1}
        onClick={() => setHideLocked(false)}
        className={FLOATING_PANEL}
      >
        <Eye />
        Show controls
        <Kbd>H</Kbd>
      </Button>
    </div>
  );
}
