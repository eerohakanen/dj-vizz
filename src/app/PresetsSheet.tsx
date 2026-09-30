import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Download,
  EllipsisVertical,
  FolderPlus,
  Pencil,
  Play,
  RefreshCw,
  Save,
  Settings2,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { showMessage, showWarning } from '@/dom';
import {
  NAME_LIMIT,
  createFolder,
  currentFolder,
  defaultPresetName,
  deleteFolder,
  deletePreset,
  describePreset,
  exportLibrary,
  importLibraryFile,
  library,
  movePreset,
  overwritePreset,
  playlist,
  renameFolder,
  restorePreset,
  savePreset,
  selectFolder,
  type Preset,
} from '@/presets/library';
import { loadPreset, togglePlayback } from '@/presets/playlist';
import { useEngine } from '@/store';
import { cn, pluralize } from '@/lib/utils';
import { FolderSelect, PlaybackOptions, useOverlay } from './shared';

interface NameRequest {
  title: string;
  description: string;
  action: string;
  initial: string;
  onSubmit: (name: string) => void;
}

function NameDialog({ request, onClose }: { request: NameRequest | null; onClose: () => void }) {
  const [name, setName] = useState('');
  const open = !!request;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    request?.onSubmit(name);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm" onOpenAutoFocus={() => setName(request?.initial ?? '')}>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{request?.title}</DialogTitle>
            <DialogDescription>{request?.description}</DialogDescription>
          </DialogHeader>
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={NAME_LIMIT} autoFocus />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{request?.action}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface FolderBarProps {
  onRequestName: (request: NameRequest) => void;
  onRequestDelete: () => void;
  onImport: () => void;
}

function FolderBar({ onRequestName, onRequestDelete, onImport }: FolderBarProps) {
  return (
    <div className="flex gap-2">
      <FolderSelect value={library.cur} onChange={selectFolder} className="min-w-0 flex-1" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Folder actions">
            <Settings2 />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onSelect={() =>
              onRequestName({
                title: 'New folder',
                description: 'Folders group looks you want to play together.',
                action: 'Create',
                initial: `Folder ${library.folders.length + 1}`,
                onSubmit: createFolder,
              })
            }
          >
            <FolderPlus />
            New folder
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              onRequestName({
                title: 'Rename folder',
                description: `Rename "${currentFolder().name}".`,
                action: 'Rename',
                initial: currentFolder().name,
                onSubmit: renameFolder,
              })
            }
          >
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={exportLibrary}>
            <Download />
            Export all
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onImport}>
            <Upload />
            Import…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onRequestDelete}>
            <Trash2 />
            Delete folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SaveLook() {
  const [name, setName] = useState('');

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const preset = savePreset(name);
    setName('');
    showMessage(`Saved "${preset.name}" to ${currentFolder().name}`);
  };

  return (
    <form onSubmit={save} className="flex gap-2">
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={defaultPresetName()}
        maxLength={NAME_LIMIT}
        aria-label="Preset name"
      />
      <Button type="submit">
        <Save />
        Save look
      </Button>
    </form>
  );
}

function removePreset(index: number) {
  const folder = currentFolder();
  const removed = deletePreset(index);
  if (!removed) return;
  const undo = () => {
    if (library.folders.includes(folder)) restorePreset(removed, index, folder);
    else showWarning(`Could not restore "${removed.name}" because its folder was deleted.`);
  };
  showMessage(`Deleted "${removed.name}"`, { label: 'Undo', onClick: undo });
}

function PresetRow({ preset, index, count }: { preset: Preset; index: number; count: number }) {
  const current = index === playlist.selected;
  return (
    <li
      className={cn(
        'group flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-accent/60',
        current && 'bg-primary/10 hover:bg-primary/15',
      )}
    >
      <button type="button" onClick={() => loadPreset(index)} className="min-w-0 flex-1 px-3 py-2 text-left outline-none">
        <div className={cn('truncate text-sm font-medium', current && 'text-primary')}>{preset.name}</div>
        <div className="truncate text-xs text-muted-foreground">{describePreset(preset)}</div>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${preset.name}`}>
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => loadPreset(index)}>
            <Play />
            Load
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              overwritePreset(index);
              showMessage(`Updated "${preset.name}"`);
            }}
          >
            <RefreshCw />
            Overwrite with current look
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={index === 0} onSelect={() => movePreset(index, -1)}>
            <ArrowUp />
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={index === count - 1} onSelect={() => movePreset(index, 1)}>
            <ArrowDown />
            Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => removePreset(index)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function PlaybackControls() {
  return (
    <div className="space-y-3">
      <PlaybackOptions compact />
      <Button className="w-full" variant={playlist.playing ? 'secondary' : 'default'} onClick={togglePlayback}>
        {playlist.playing ? <Square className="fill-current" /> : <Play />}
        {playlist.playing ? 'Stop playing' : 'Play folder'}
      </Button>
    </div>
  );
}

export function PresetsSheet() {
  useEngine();
  const [nameRequest, setNameRequest] = useState<NameRequest | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folder = currentFolder();

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const count = await importLibraryFile(file);
      showMessage(`Imported ${pluralize(count, 'folder')}`);
    } catch {
      showWarning('Could not read that file. Use a file made with Export.');
    }
  };

  return (
    <>
      <Sheet {...useOverlay('presets')}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Presets</SheetTitle>
            <SheetDescription>Save looks into folders, then play a folder as a set.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4">
            <FolderBar
              onRequestName={setNameRequest}
              onRequestDelete={() => setConfirmDelete(true)}
              onImport={() => fileInput.current?.click()}
            />
            <SaveLook />
          </div>
          <Separator className="mt-4" />
          <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
            {folder.presets.length ? (
              folder.presets.map((preset, index) => (
                <PresetRow key={index} preset={preset} index={index} count={folder.presets.length} />
              ))
            ) : (
              <li className="px-3 py-10 text-center text-sm text-muted-foreground">
                No presets yet. Set up a look and press Save look.
              </li>
            )}
          </ol>
          <Separator />
          <SheetFooter>
            <PlaybackControls />
          </SheetFooter>
          <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importFile} />
        </SheetContent>
      </Sheet>
      <NameDialog request={nameRequest} onClose={() => setNameRequest(null)} />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{folder.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the folder and its {pluralize(folder.presets.length, 'preset')}. Export
              first if you want a backup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={deleteFolder}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
