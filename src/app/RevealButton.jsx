import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { setHideLocked } from '@/actions.js';
import { ui, useEngine } from '@/store.js';
import { cn } from '@/lib/utils';

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
        className="bg-card/80 shadow-2xl backdrop-blur-xl"
      >
        <Eye />
        Show controls
        <Kbd>H</Kbd>
      </Button>
    </div>
  );
}
