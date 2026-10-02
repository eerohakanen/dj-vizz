import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clock } from '../state';
import { currentFolder, createPreset, library, playlist } from './library';
import { advanceTimedPlaylist, currentChangeOn, currentShuffle, nextPreset, previousPreset, setChangeOn, setShuffle, setTransition, shiftPlaylistClock } from './playlist';

vi.mock('../canvas', () => ({ output: {}, transitionCtx: {}, transitionFrame: {} }));
vi.mock('../modes/index', () => ({ MODES: [] }));
vi.mock('../mode', () => ({ setMode: vi.fn() }));
vi.mock('../audio/input', () => ({ audio: { live: true }, disconnectAudio: vi.fn() }));
vi.mock('../color', () => ({ setPalette: vi.fn() }));
vi.mock('../dom', () => ({ showMessage: vi.fn() }));

describe('shiftPlaylistClock', () => {
  beforeEach(() => {
    playlist.playing = true;
    setChangeOn('s15');
    playlist.startedAt = 100;
    playlist.index = 3;
  });

  it('moves the start time forward by the paused gap', () => {
    shiftPlaylistClock(50);
    expect(playlist.startedAt).toBe(150);
  });

  it('does not advance right after a long pause once shifted', () => {
    shiftPlaylistClock(50);
    clock.time = 155;
    advanceTimedPlaylist();
    expect(playlist.index).toBe(3);
  });
});

describe('folder playback options', () => {
  beforeEach(() => {
    library.cur = 0;
    playlist.playing = false;
  });

  it('writes change timing, shuffle and transition to the current folder', () => {
    setChangeOn('drop');
    setShuffle(true);
    setTransition('iris');
    expect(currentFolder()).toMatchObject({ changeOn: 'drop', shuffle: true, transition: 'iris' });
    expect(currentChangeOn()).toBe('drop');
    expect(currentShuffle()).toBe(true);
  });

  it('keeps options per folder', () => {
    setChangeOn('s60');
    library.cur = library.folders.push({ name: 'Other', presets: [], transition: 'random', changeOn: 'b16', shuffle: false }) - 1;
    expect(currentChangeOn()).toBe('b16');
    library.cur = 0;
    expect(currentChangeOn()).toBe('s60');
    library.folders.pop();
  });
});

describe('previousPreset', () => {
  it('steps back and wraps to the last scene', () => {
    library.cur = 0;
    library.folders[0].presets = ['a', 'b', 'c'].map((name) => createPreset(name, 0, 0));
    playlist.index = 1;
    previousPreset();
    expect(playlist.index).toBe(0);
    previousPreset();
    expect(playlist.index).toBe(2);
  });
});

describe('nextPreset', () => {
  beforeEach(() => {
    library.cur = 0;
    playlist.playing = true;
    setShuffle(false);
  });

  it('does nothing when the preset has a single scene', async () => {
    const { setMode } = await import('../mode');
    library.folders[0].presets = [createPreset('only', 0, 0)];
    playlist.index = 0;
    playlist.startedAt = 5;
    vi.mocked(setMode).mockClear();
    nextPreset();
    expect(setMode).not.toHaveBeenCalled();
    expect(playlist.startedAt).toBe(5);
  });

  it('steps in order when not playing even with shuffle on', () => {
    library.folders[0].presets = ['a', 'b', 'c', 'd'].map((name) => createPreset(name, 0, 0));
    setShuffle(true);
    playlist.playing = false;
    playlist.index = 0;
    for (const expected of [1, 2, 3, 0]) {
      nextPreset();
      expect(playlist.index).toBe(expected);
    }
  });

  it('shuffles to a different scene during playback', () => {
    library.folders[0].presets = ['a', 'b', 'c', 'd'].map((name) => createPreset(name, 0, 0));
    setShuffle(true);
    playlist.index = 1;
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.3).mockReturnValueOnce(0.9);
    nextPreset();
    expect(playlist.index).toBe(3);
    vi.restoreAllMocks();
  });
});
