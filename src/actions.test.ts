import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  captureScene,
  duplicateAndEditScene,
  editScene,
  enterEdit,
  enterPlay,
  explore,
  goLive,
  leaveSetup,
  newPreset,
  nextScene,
  openPresets,
  previousScene,
  switchToEdit,
  switchToPlay,
} from './actions';
import { audio } from './audio/input';
import { showMessage } from './dom';
import { createPreset, library, playlist } from './presets/library';
import { settings } from './state';
import { ui } from './store';

vi.mock('./canvas', () => ({ output: {}, transitionCtx: {}, transitionFrame: {} }));
vi.mock('./modes/index', () => ({ MODES: Array.from({ length: 12 }, (_, index) => ({ name: `Mode ${index}` })) }));
vi.mock('./mode', () => ({ setMode: vi.fn() }));
vi.mock('./color', () => ({ setPalette: vi.fn() }));
vi.mock('./dom', () => ({ showMessage: vi.fn() }));
vi.mock('./audio/input', () => ({ audio: { live: true }, disconnectAudio: vi.fn() }));

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal('document', { fullscreenElement: null });
  audio.live = true;
  library.cur = 0;
  library.folders.splice(1);
  library.folders[0].presets = [createPreset('One', 0, 1), createPreset('Two', 2, 3)];
  Object.assign(ui, { screen: 'landing', liveMode: 'explore', overlay: null });
  playlist.playing = false;
});

describe('navigation actions', () => {
  it('enterPlay goes live and starts playback when audio is live', () => {
    enterPlay(0);
    expect(ui).toMatchObject({ screen: 'live', liveMode: 'play', overlay: null });
    expect(playlist.playing).toBe(true);
    expect(playlist.index).toBe(0);
  });

  it('enterPlay goes to setup first and plays on goLive', () => {
    audio.live = false;
    enterPlay(0);
    expect(ui.screen).toBe('setup');
    expect(playlist.playing).toBe(false);
    goLive();
    expect(ui.screen).toBe('live');
    expect(playlist.playing).toBe(true);
  });

  it('enterEdit opens the scene editor on the first scene without playing', () => {
    enterEdit(0);
    expect(ui).toMatchObject({ screen: 'live', liveMode: 'edit', overlay: 'scenes' });
    expect(playlist.playing).toBe(false);
    expect(playlist.selected).toBe(0);
  });

  it('newPreset creates a preset with one scene in edit mode', () => {
    newPreset();
    expect(library.folders).toHaveLength(2);
    expect(library.cur).toBe(1);
    expect(library.folders[1].presets).toHaveLength(1);
    expect(ui.liveMode).toBe('edit');
    expect(playlist.selected).toBe(0);
  });

  it('switches between play and edit in place', () => {
    enterEdit(0);
    switchToPlay();
    expect(ui).toMatchObject({ liveMode: 'play', overlay: null });
    expect(playlist.playing).toBe(true);
    switchToEdit();
    expect(ui).toMatchObject({ liveMode: 'edit', overlay: 'scenes' });
    expect(playlist.playing).toBe(false);
  });

  it('turns auto-switch off when entering or switching to edit', () => {
    settings.auto = true;
    enterEdit(0);
    expect(settings.auto).toBe(false);
    switchToPlay();
    settings.auto = true;
    switchToEdit();
    expect(settings.auto).toBe(false);
  });

  it('openPresets stops playback and keeps audio connected', () => {
    enterPlay(0);
    openPresets();
    expect(ui.screen).toBe('presets');
    expect(playlist.playing).toBe(false);
    expect(audio.live).toBe(true);
  });

  it('leaving setup returns to presets for play and edit', () => {
    audio.live = false;
    enterEdit(0);
    leaveSetup();
    expect(ui.screen).toBe('presets');
    enterPlay(0);
    leaveSetup();
    expect(ui.screen).toBe('presets');
  });

  it('leaving setup from explore returns to landing', () => {
    audio.live = false;
    explore();
    expect(ui.screen).toBe('setup');
    leaveSetup();
    expect(ui.screen).toBe('landing');
  });

  it('explore goes live in explore mode', () => {
    explore();
    expect(ui).toMatchObject({ screen: 'live', liveMode: 'explore' });
  });
});

describe('scene editing actions', () => {
  const scenes = () => library.folders[0].presets;

  beforeEach(() => {
    enterEdit(0);
    settings.mode = 7;
  });

  it('saves pending edits before selecting another scene', () => {
    editScene(1);
    expect(scenes()[0].mode).toBe(7);
    expect(playlist.selected).toBe(1);
  });

  it('captures the current look as a new selected scene after saving edits', () => {
    expect(captureScene()).toBe(2);
    expect(scenes().map((scene) => scene.mode)).toEqual([7, 2, 7]);
    expect(playlist.selected).toBe(2);
  });

  it('duplicates a scene and loads the copy for editing', () => {
    expect(duplicateAndEditScene(0)).toBe(1);
    expect(scenes().map((scene) => scene.name)).toEqual(['One', 'One copy', 'Two']);
    expect(scenes()[1].mode).toBe(7);
    expect(playlist.index).toBe(1);
  });

  it('steps through scenes while playing', () => {
    switchToPlay();
    nextScene();
    expect(playlist.index).toBe(1);
    previousScene();
    expect(playlist.index).toBe(0);
  });
});

describe('scene guards', () => {
  it('re-applies the stored scene quietly when switching to edit', () => {
    enterEdit(0);
    switchToPlay();
    settings.psy = 3;
    vi.mocked(showMessage).mockClear();
    switchToEdit();
    expect(settings.psy).toBe(0);
    expect(playlist.selected).toBe(0);
    expect(showMessage).not.toHaveBeenCalled();
  });

  it('does not reload the scene already being edited', () => {
    enterEdit(0);
    playlist.beats = 5;
    editScene(0);
    expect(playlist.beats).toBe(5);
  });

  it('does not step when the preset has fewer than two scenes', () => {
    library.folders[0].presets = [createPreset('Only', 0, 1)];
    enterPlay(0);
    playlist.beats = 5;
    nextScene();
    previousScene();
    expect(playlist.beats).toBe(5);
  });
});
