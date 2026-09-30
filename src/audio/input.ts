import { showMessage } from '../dom';
import { notify } from '../store';

const UNPROCESSED = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

const DISPLAY_CAPTURE = {
  video: true,
  audio: UNPROCESSED,
  systemAudio: 'include',
  windowAudio: 'system',
  selfBrowserSurface: 'exclude',
  surfaceSwitching: 'include',
  monitorTypeSurfaces: 'include',
};

type AudioSourceKind = 'window' | 'mic';

export const audio = {
  analyser: null as AnalyserNode | null,
  frequencies: new Uint8Array(1024),
  waveform: new Uint8Array(2048),
  live: false,
  source: null as AudioSourceKind | null,
};

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

let context: AudioContext | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let stream: MediaStream | null = null;

function ensureContext() {
  if (!context) {
    context = new (window.AudioContext || window.webkitAudioContext!)();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.7;
    audio.analyser = analyser;
    audio.frequencies = new Uint8Array(analyser.frequencyBinCount);
    audio.waveform = new Uint8Array(analyser.fftSize);
  }
  if (context.state === 'suspended') context.resume();
  return context;
}

export function disconnectAudio() {
  stopInput();
  notify();
}

function stopInput() {
  try {
    source?.disconnect();
  } catch {}
  source = null;
  stream?.getTracks().forEach((track) => {
    track.onended = null;
    track.stop();
  });
  stream = null;
  audio.live = false;
  audio.source = null;
}

function useStream(mediaStream: MediaStream, kind: AudioSourceKind) {
  stopInput();
  const audioContext = ensureContext();
  stream = mediaStream;
  source = audioContext.createMediaStreamSource(mediaStream);
  source.connect(audio.analyser!);
  audio.live = true;
  audio.source = kind;
  mediaStream.getTracks().forEach((track) => {
    track.onended = () => {
      audio.live = false;
      audio.source = null;
      showMessage('Audio source ended.');
      notify();
    };
  });
  notify();
}

export async function captureWindow() {
  try {
    const captured = await navigator.mediaDevices.getDisplayMedia(DISPLAY_CAPTURE);
    if (!captured.getAudioTracks().length) {
      captured.getTracks().forEach((track) => track.stop());
      return { error: 'No audio was shared. Pick a tab, window or entire screen and turn on "Share audio" in the picker.' };
    }
    captured.getVideoTracks().forEach((track) => track.stop());
    useStream(new MediaStream(captured.getAudioTracks()), 'window');
    return { ok: true };
  } catch (error) {
    return { error: `Could not capture audio (${(error as Error).name}). If embedded, open this page in its own browser tab.` };
  }
}

export async function captureMicrophone() {
  try {
    useStream(await navigator.mediaDevices.getUserMedia({ audio: UNPROCESSED }), 'mic');
    return { ok: true };
  } catch (error) {
    return { error: `Microphone blocked (${(error as Error).name}). Allow microphone access for this page and try again.` };
  }
}
