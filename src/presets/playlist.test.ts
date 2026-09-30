import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clock } from '../state';
import { currentFolder, createPreset, library, playlist } from './library';
import { advanceTimedPlaylist, currentChangeOn, currentShuffle, previousPreset, setChangeOn, setShuffle, setTransition, shiftPlaylistClock } from './playlist';

vi.mock('../canvas', () => ({ output: {}, transitionCtx: {}, transitionFrame: {} }));
vi.mock('../modes/index', () => ({ MODES: [] }));
vi.mock('../mode', () => ({ setMode: vi.fn() }));
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
    library.folders.push({ name: 'Other', presets: [], transition: 'random', changeOn: 'b16', shuffle: false });
    library.cur = 1;
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
