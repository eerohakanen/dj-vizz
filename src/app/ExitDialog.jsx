import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { closeOverlay } from '@/actions.js';
import { ui, useEngine } from '@/store.js';

export function ExitDialog({ onExit }) {
  useEngine();
  return (
    <AlertDialog
      open={ui.overlay === 'exit'}
      onOpenChange={(open) => {
        if (!open) closeOverlay();
      }}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Back to main menu?</AlertDialogTitle>
          <AlertDialogDescription>The audio source disconnects and a playing folder stops.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay</AlertDialogCancel>
          <AlertDialogAction onClick={onExit}>Exit</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
