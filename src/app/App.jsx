import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { notify, ui, useEngine } from '@/store.js';
import { HelpDialog } from './HelpDialog.jsx';
import { Landing } from './Landing.jsx';
import { PresetsSheet } from './PresetsSheet.jsx';
import { Setup } from './Setup.jsx';
import { Toolbar } from './Toolbar.jsx';

export function App() {
  useEngine();
  const [screen, setScreen] = useState('landing');

  const goLive = () => {
    ui.live = true;
    setScreen('live');
    notify();
  };

  return (
    <TooltipProvider delayDuration={300}>
      {screen === 'landing' && <Landing onStart={() => setScreen('setup')} />}
      {screen === 'setup' && <Setup onBack={() => setScreen('landing')} onDone={goLive} />}
      {screen === 'live' && (
        <>
          <Toolbar />
          <PresetsSheet />
          <HelpDialog />
        </>
      )}
      <Toaster position="top-center" />
    </TooltipProvider>
  );
}
