import { useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { leaveVisualizer } from '@/actions';
import { notify, ui, useEngine, type Screen } from '@/store';
import { AnalysisHud } from './AnalysisHud';
import { ExitDialog } from './ExitDialog';
import { HelpDialog } from './HelpDialog';
import { Landing } from './Landing';
import { PresetsSheet } from './PresetsSheet';
import { RevealButton } from './RevealButton';
import { Setup } from './Setup';
import { Toolbar } from './Toolbar';
import { TuningSheet } from './TuningSheet';

export function App() {
  useEngine();
  const { screen } = ui;
  const cursorHidden = ui.controlsHidden && !ui.peek;

  useEffect(() => {
    document.body.classList.toggle('cursor-none', cursorHidden);
  }, [cursorHidden]);

  const goTo = (next: Screen) => {
    ui.screen = next;
    notify();
  };

  return (
    <TooltipProvider delayDuration={300}>
      {screen === 'landing' && <Landing onStart={() => goTo('setup')} />}
      {screen === 'setup' && <Setup onBack={() => goTo('landing')} onDone={() => goTo('live')} />}
      {screen === 'live' && (
        <>
          <Toolbar />
          <RevealButton />
          <PresetsSheet />
          <TuningSheet />
          <HelpDialog />
          <ExitDialog onExit={leaveVisualizer} />
          {ui.debug && <AnalysisHud />}
        </>
      )}
      <Toaster position="top-center" />
    </TooltipProvider>
  );
}
