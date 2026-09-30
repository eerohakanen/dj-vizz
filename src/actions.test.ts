import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enterEdit, enterPlay, explore, goLive, newPreset, openPresets, switchToEdit, switchToPlay } from './actions';
import { audio } from './audio/input';
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

  it('explore goes live in explore mode', () => {
    explore();
    expect(ui).toMatchObject({ screen: 'live', liveMode: 'explore' });
  });
});
