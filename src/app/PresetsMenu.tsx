import { useRef, useState, type ChangeEvent } from 'react';
import {
  Compass,
  Download,
  EllipsisVertical,
  ListMusic,
  Pencil,
  Play,
  Plus,
  Shuffle,
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { enterEdit, enterPlay, explore, newPreset } from '@/actions';
import { showMessage, showWarning } from '@/dom';
import { DEFAULT_TRANSITION, findTransition } from '@/effects/transition';
import { PALETTES } from '@/palettes';
import { changeOption } from '@/presets/change';
import { deleteFolder, exportLibrary, importLibraryFile, library, renameFolder, type Folder } from '@/presets/library';
import { useEngine } from '@/store';
import { pluralize } from '@/lib/utils';
import { NameDialog, type NameRequest } from './NameDialog';
import { IconTile, MenuBackdrop, MenuNav, swatchStyle } from './shared';

const SWATCH_LIMIT = 6;

function SceneSwatches({ folder }: { folder: Folder }) {
  const extra = folder.presets.length - SWATCH_LIMIT;
  if (!folder.presets.length) return <p className="text-sm text-muted-foreground">No scenes yet</p>;
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {folder.presets.slice(0, SWATCH_LIMIT).map((scene, index) => {
        const palette = PALETTES[scene.palette];
        return (
          <span
            key={index}
            title={scene.name}
            className="size-5 rounded-full border border-border/60 shadow-sm"
            style={palette && swatchStyle(palette)}
          />
        );
      })}
      {extra > 0 && <span className="pl-1 text-xs text-muted-foreground">+{extra}</span>}
    </div>
  );
}

interface PresetCardProps {
  folder: Folder;
  index: number;
  onRename: () => void;
  onDelete: () => void;
}

function PresetCard({ folder, index, onRename, onDelete }: PresetCardProps) {
  const empty = !folder.presets.length;
  return (
    <Card className="w-full gap-4 bg-card/80 backdrop-blur transition-colors hover:border-primary/40">
      <CardHeader>
        <CardTitle className="min-w-0 truncate text-lg">{folder.name}</CardTitle>
        <CardDescription>{pluralize(folder.presets.length, 'scene')}</CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${folder.name}`}>
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={onRename}>
                <Pencil />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <SceneSwatches folder={folder} />
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{changeOption(folder.changeOn).label}</Badge>
          <Badge variant="outline">{(findTransition(folder.transition) ?? findTransition(DEFAULT_TRANSITION))?.label} transition</Badge>
          {folder.shuffle && (
            <Badge variant="outline">
              <Shuffle />
              Shuffle
            </Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="mt-auto gap-2">
        <Button className="flex-1" disabled={empty} onClick={() => enterPlay(index)} aria-label={empty ? undefined : `Play ${folder.name}`}>
          <Play />
          {empty ? 'Add scenes to play' : 'Play'}
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => enterEdit(index)} aria-label={`Edit ${folder.name}`}>
          <Pencil />
          Edit
        </Button>
      </CardFooter>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="items-center bg-card/80 px-6 py-12 text-center backdrop-blur">
      <IconTile>
        <ListMusic className="size-5" />
      </IconTile>
      <div className="max-w-sm space-y-2">
        <h2 className="text-xl font-semibold">No presets yet</h2>
        <p className="text-muted-foreground">
          A preset is a sequence of scenes that plays through your set. Create one, or explore freely and come back
          later.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={newPreset} autoFocus>
          <Plus />
          New preset
        </Button>
        <Button variant="outline" onClick={explore}>
          <Compass />
          Explore instead
        </Button>
      </div>
    </Card>
  );
}

export function PresetsMenu() {
  useEngine();
  const [nameRequest, setNameRequest] = useState<NameRequest | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingDelete = deleteIndex === null ? undefined : library.folders[deleteIndex];

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const count = await importLibraryFile(file);
      showMessage(`Imported ${pluralize(count, 'preset')}`);
    } catch {
      showWarning('Could not read that file. Use a file made with Export.');
    }
  };

  const requestRename = (folder: Folder, index: number) =>
    setNameRequest({
      title: 'Rename preset',
      description: `Rename "${folder.name}".`,
      action: 'Rename',
      initial: folder.name,
      onSubmit: (name) => renameFolder(name, index),
    });

  const confirmDelete = () => {
    if (deleteIndex !== null) deleteFolder(deleteIndex);
    setDeleteIndex(null);
  };

  const libraryMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Import or export presets">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
          <Upload />
          Import…
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!library.folders.length} onSelect={exportLibrary}>
          <Download />
          Export all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <main className="fixed inset-0 flex flex-col overflow-y-auto">
      <MenuBackdrop />
      <MenuNav screen="presets" width="max-w-5xl" actions={libraryMenu} />
      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">My presets</h1>
            <p className="text-muted-foreground">Sequences of scenes that play through your set.</p>
          </div>
          {!!library.folders.length && (
            <Button className="w-full sm:w-auto" onClick={newPreset}>
              <Plus />
              New preset
            </Button>
          )}
        </header>
        {library.folders.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {library.folders.map((folder, index) => (
              <li key={index} className="flex">
                <PresetCard
                  folder={folder}
                  index={index}
                  onRename={() => requestRename(folder, index)}
                  onDelete={() => setDeleteIndex(index)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </div>
      <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importFile} />
      <NameDialog request={nameRequest} onClose={() => setNameRequest(null)} />
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setDeleteIndex(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the preset and its {pluralize(pendingDelete?.presets.length ?? 0, 'scene')}. It can't be
              undone, so export first if you want a backup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
