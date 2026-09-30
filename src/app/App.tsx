import { useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { leaveVisualizer } from '@/actions';
import { notify, ui, useEngine } from '@/store';
import { ExitDialog } from './ExitDialog';
import { HelpDialog } from './HelpDialog';
import { Landing } from './Landing';
import { PresetsSheet } from './PresetsSheet';
import { RevealButton } from './RevealButton';
import { Setup } from './Setup';
import { Toolbar } from './Toolbar';

export function App() {
  useEngine();
  const [screen, setScreen] = useState('landing');
  const cursorHidden = ui.controlsHidden && !ui.peek;

  useEffect(() => {
    document.body.classList.toggle('cursor-none', cursorHidden);
  }, [cursorHidden]);

  const goLive = () => {
    ui.live = true;
    setScreen('live');
    notify();
  };

  const exitToMenu = () => {
    leaveVisualizer();
    setScreen('landing');
  };

  return (
    <TooltipProvider delayDuration={300}>
      {screen === 'landing' && <Landing onStart={() => setScreen('setup')} />}
      {screen === 'setup' && <Setup onBack={() => setScreen('landing')} onDone={goLive} />}
      {screen === 'live' && (
        <>
          <Toolbar />
          <RevealButton />
          <PresetsSheet />
          <HelpDialog />
          <ExitDialog onExit={exitToMenu} />
        </>
      )}
      <Toaster position="top-center" />
    </TooltipProvider>
  );
}
