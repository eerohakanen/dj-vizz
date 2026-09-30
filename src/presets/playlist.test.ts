import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clock } from '../state';
import { playlist } from './library';
import { advanceTimedPlaylist, shiftPlaylistClock } from './playlist';

vi.mock('../modes/index', () => ({ MODES: [] }));
vi.mock('../mode', () => ({ setMode: vi.fn() }));
vi.mock('../color', () => ({ setPalette: vi.fn() }));
vi.mock('../dom', () => ({ showMessage: vi.fn() }));

describe('shiftPlaylistClock', () => {
  beforeEach(() => {
    playlist.playing = true;
    playlist.changeOn = 's15';
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
