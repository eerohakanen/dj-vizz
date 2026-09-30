import { useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { goLive, leaveSetup, leaveVisualizer } from '@/actions';
import { holdWakeLock } from '@/wake-lock';
import { ui, useEngine } from '@/store';
import { AnalysisHud } from './AnalysisHud';
import { ExitDialog } from './ExitDialog';
import { HelpDialog } from './HelpDialog';
import { Landing } from './Landing';
import { PresetsMenu } from './PresetsMenu';
import { PresetsSheet } from './PresetsSheet';
import { RevealButton } from './RevealButton';
import { Setup } from './Setup';
import { StatusPills } from './StatusPills';
import { Toolbar } from './Toolbar';
import { TuningSheet } from './TuningSheet';

export function App() {
  useEngine();
  const { screen } = ui;
  const cursorHidden = ui.controlsHidden && !ui.peek;

  useEffect(() => {
    document.body.classList.toggle('cursor-none', cursorHidden);
  }, [cursorHidden]);

  useEffect(() => {
    if (screen === 'live') return holdWakeLock();
  }, [screen]);

  return (
    <TooltipProvider delayDuration={300}>
      {screen === 'landing' && <Landing />}
      {screen === 'presets' && <PresetsMenu />}
      {screen === 'setup' && <Setup onBack={leaveSetup} onDone={goLive} />}
      {screen === 'live' && (
        <>
          <Toolbar />
          <RevealButton />
          <StatusPills />
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
