import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../store', () => ({ notify: vi.fn() }));

function fakeStream() {
  const track = { stop: vi.fn(), onended: null as (() => void) | null };
  return { track, stream: { getTracks: () => [track], getAudioTracks: () => [track], getVideoTracks: () => [] } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class FakeAudioContext {
  state = 'running';
  sampleRate = 48000;
  createAnalyser() {
    return { fftSize: 0, smoothingTimeConstant: 0, frequencyBinCount: 1024 };
  }
  createMediaStreamSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }
}

const getUserMedia = vi.fn();

async function loadInput() {
  vi.resetModules();
  return import('./input');
}

beforeEach(() => {
  getUserMedia.mockReset();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('AudioContext', FakeAudioContext);
});

describe('audio capture', () => {
  it('ignores an earlier capture that resolves after a newer one connected', async () => {
    const { audio, captureMicrophone } = await loadInput();
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    getUserMedia.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const stale = fakeStream();
    const current = fakeStream();

    const firstResult = captureMicrophone();
    const secondResult = captureMicrophone();
    second.resolve(current.stream);
    expect(await secondResult).toEqual({ ok: true });
    first.resolve(stale.stream);

    expect(await firstResult).toEqual({ superseded: true });
    expect(stale.track.stop).toHaveBeenCalledOnce();
    expect(current.track.stop).not.toHaveBeenCalled();
    expect(audio.live).toBe(true);
    expect(audio.source).toBe('mic');
  });

  it('drops a pending capture once audio is disconnected', async () => {
    const { audio, captureMicrophone, disconnectAudio } = await loadInput();
    const pending = deferred<unknown>();
    getUserMedia.mockReturnValueOnce(pending.promise);
    const late = fakeStream();

    const result = captureMicrophone();
    disconnectAudio();
    pending.resolve(late.stream);

    expect(await result).toEqual({ superseded: true });
    expect(late.track.stop).toHaveBeenCalledOnce();
    expect(audio.live).toBe(false);
  });

  it('does not report an error from a capture that was superseded', async () => {
    const { captureMicrophone } = await loadInput();
    const first = deferred<unknown>();
    getUserMedia.mockReturnValueOnce(first.promise).mockResolvedValueOnce(fakeStream().stream);

    const firstResult = captureMicrophone();
    await captureMicrophone();
    first.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));

    expect(await firstResult).toEqual({ superseded: true });
  });

  it('still reports an error from the latest capture', async () => {
    const { captureMicrophone } = await loadInput();
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));

    const result = await captureMicrophone();

    expect(result.error).toContain('Microphone blocked (NotAllowedError)');
  });
});
