import { useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { leaveVisualizer } from '@/actions.js';
import { notify, ui, useEngine } from '@/store.js';
import { ExitDialog } from './ExitDialog.jsx';
import { HelpDialog } from './HelpDialog.jsx';
import { Landing } from './Landing.jsx';
import { PresetsSheet } from './PresetsSheet.jsx';
import { RevealButton } from './RevealButton.jsx';
import { Setup } from './Setup.jsx';
import { Toolbar } from './Toolbar.jsx';

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
