import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CloudCheck, Copy, EllipsisVertical, ListMusic, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { captureScene, duplicateAndEditScene, editScene, openPresets, switchToPlay } from '@/actions';
import { showMessage, showWarning } from '@/dom';
import { PALETTES } from '@/palettes';
import {
  NAME_LIMIT,
  currentFolder,
  deletePreset,
  describePreset,
  library,
  movePreset,
  playlist,
  renameFolder,
  renameScene,
  restorePreset,
  type Folder,
  type Preset,
} from '@/presets/library';
import { useEngine } from '@/store';
import { cn } from '@/lib/utils';
import { NameDialog, type NameRequest } from './NameDialog';
import { GLASS_PANEL, PlaybackOptions, swatchStyle, useOverlay } from './shared';

const SECTION_HEADING = 'text-xs font-medium uppercase tracking-wide text-muted-foreground';

function removeScene(index: number) {
  const folder = currentFolder();
  const wasSelected = playlist.selected === index;
  const removed = deletePreset(index);
  if (!folder || !removed) return;
  if (wasSelected && folder.presets.length) editScene(Math.min(index, folder.presets.length - 1));
  const undo = () => {
    if (library.folders.includes(folder)) restorePreset(removed, index, folder);
    else showWarning(`Could not restore "${removed.name}" because its preset was deleted.`);
  };
  showMessage(`Deleted "${removed.name}"`, { label: 'Undo', onClick: undo });
}

function addScene() {
  captureScene();
  showMessage('Scene added. Tweak the visuals — the scene saves as you go.');
}

function PresetNameField({ folder }: { folder: Folder }) {
  const [draft, setDraft] = useState(folder.name);
  return (
    <Input
      value={draft}
      maxLength={NAME_LIMIT}
      aria-label="Preset name"
      className="h-10 text-base font-semibold"
      onChange={(event) => {
        setDraft(event.target.value);
        renameFolder(event.target.value);
      }}
      onBlur={() => setDraft(folder.name)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

interface SceneRowProps {
  scene: Preset;
  index: number;
  count: number;
  onRename: () => void;
}

function SceneRow({ scene, index, count, onRename }: SceneRowProps) {
  const current = index === playlist.selected;
  const row = useRef<HTMLLIElement>(null);
  const palette = PALETTES[scene.palette];

  useEffect(() => {
    if (current) row.current?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  return (
    <li
      ref={row}
      className={cn(
        'group flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-accent/60',
        current && 'bg-primary/10 hover:bg-primary/15',
      )}
    >
      <button
        type="button"
        aria-current={current || undefined}
        onClick={() => editScene(index)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="w-4 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{index + 1}</span>
        <span
          className="size-4 shrink-0 rounded-full border border-border/60 shadow-sm"
          style={palette && swatchStyle(palette)}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-sm font-medium', current && 'text-primary')}>{scene.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{describePreset(scene)}</span>
        </span>
        {current && <Badge className="shrink-0">Editing</Badge>}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${scene.name}`}>
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={onRename}>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => duplicateAndEditScene(index)}>
            <Copy />
            Duplicate
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
          <DropdownMenuItem variant="destructive" onSelect={() => removeScene(index)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

export function SceneEditor() {
  useEngine();
  const [nameRequest, setNameRequest] = useState<NameRequest | null>(null);
  const folder = currentFolder();
  const scenes = folder?.presets ?? [];

  const requestRename = (scene: Preset, index: number) =>
    setNameRequest({
      title: 'Rename scene',
      description: `Rename "${scene.name}".`,
      action: 'Rename',
      initial: scene.name,
      onSubmit: (name) => renameScene(index, name),
    });

  return (
    <>
      <Sheet {...useOverlay('scenes')} modal={false}>
        <SheetContent
          overlay={false}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className={cn(GLASS_PANEL, 'flex w-full flex-col gap-0 sm:max-w-md')}
        >
          <SheetHeader className="gap-3">
            <SheetTitle className={SECTION_HEADING}>Edit preset</SheetTitle>
            {folder && <PresetNameField key={library.cur} folder={folder} />}
            <SheetDescription className="flex items-center gap-1.5 text-xs">
              <CloudCheck className="size-3.5" />
              Changes save automatically
            </SheetDescription>
            <div className="flex gap-2">
              <Button className="flex-1" disabled={!scenes.length} onClick={switchToPlay}>
                <Play />
                Play
              </Button>
              <Button variant="outline" className="flex-1" onClick={openPresets}>
                <ListMusic />
                Menu
              </Button>
            </div>
          </SheetHeader>
          <Separator />
          <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1">
            <h3 className={SECTION_HEADING}>
              Scenes <span className="tabular-nums">· {scenes.length}</span>
            </h3>
            <Button size="sm" variant="secondary" onClick={addScene}>
              <Plus />
              Add scene
            </Button>
          </div>
          {scenes.length > 0 && playlist.selected < 0 && (
            <p className="px-4 pb-1 text-xs text-muted-foreground">Pick a scene to edit it.</p>
          )}
          <ol aria-label="Scenes" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
            {scenes.length ? (
              scenes.map((scene, index) => (
                <SceneRow
                  key={index}
                  scene={scene}
                  index={index}
                  count={scenes.length}
                  onRename={() => requestRename(scene, index)}
                />
              ))
            ) : (
              <li className="px-6 py-10 text-center text-sm text-muted-foreground">
                No scenes yet. Add scene captures the current visuals.
              </li>
            )}
          </ol>
          <Separator />
          <SheetFooter className="gap-3">
            <h3 className={SECTION_HEADING}>Playback</h3>
            <PlaybackOptions />
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <NameDialog request={nameRequest} onClose={() => setNameRequest(null)} />
    </>
  );
}
