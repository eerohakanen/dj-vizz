import { notify } from '../store';
import type { AudioSourceKind } from './sources';

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

export const WINDOW_UNSUPPORTED = 'Window audio is not supported on mobile browsers. Use Microphone instead.';

export const audio = {
  analyser: null as AnalyserNode | null,
  detector: null as AnalyserNode | null,
  frequencies: new Uint8Array(1024),
  sharpFrequencies: new Uint8Array(1024),
  waveform: new Uint8Array(2048),
  samples: new Float32Array(2048),
  sampleRate: 48000,
  live: false,
  source: null as AudioSourceKind | null,
  lost: null as AudioSourceKind | null,
};

declare global {
  class CaptureController {
    setFocusBehavior(behavior: 'focus-captured-surface' | 'no-focus-change'): void;
  }
}

let context: AudioContext | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let stream: MediaStream | null = null;

function ensureContext() {
  if (!context) {
    context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.7;
    const detector = context.createAnalyser();
    detector.fftSize = analyser.fftSize;
    detector.smoothingTimeConstant = 0.15;
    audio.analyser = analyser;
    audio.detector = detector;
    audio.sampleRate = context.sampleRate;
    audio.frequencies = new Uint8Array(analyser.frequencyBinCount);
    audio.sharpFrequencies = new Uint8Array(detector.frequencyBinCount);
    audio.waveform = new Uint8Array(analyser.fftSize);
    audio.samples = new Float32Array(detector.fftSize);
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
  audio.lost = null;
}

function useStream(mediaStream: MediaStream, kind: AudioSourceKind) {
  stopInput();
  const audioContext = ensureContext();
  stream = mediaStream;
  source = audioContext.createMediaStreamSource(mediaStream);
  source.connect(audio.analyser!);
  source.connect(audio.detector!);
  audio.live = true;
  audio.source = kind;
  mediaStream.getTracks().forEach((track) => {
    track.onended = () => {
      audio.live = false;
      audio.source = null;
      audio.lost = kind;
      notify();
    };
  });
  notify();
}

type CaptureResult = { ok: true; error?: undefined } | { ok?: false; error: string };

export const canCaptureWindow = !!navigator.mediaDevices?.getDisplayMedia;

function createCaptureController() {
  return 'CaptureController' in window ? new CaptureController() : undefined;
}

function keepFocusHere(controller: CaptureController | undefined) {
  try {
    controller?.setFocusBehavior('no-focus-change');
  } catch {}
}

export async function captureWindow(): Promise<CaptureResult> {
  if (!canCaptureWindow) {
    return { error: WINDOW_UNSUPPORTED };
  }
  const controller = createCaptureController();
  let captured: MediaStream;
  try {
    captured = await navigator.mediaDevices.getDisplayMedia({ ...DISPLAY_CAPTURE, controller } as DisplayMediaStreamOptions);
  } catch (error) {
    const name = (error as Error).name;
    if (name === 'NotAllowedError') return { error: 'Sharing cancelled.' };
    return { error: `Could not capture audio (${name}). If embedded, open this page in its own browser tab.` };
  }
  keepFocusHere(controller);
  if (!captured.getAudioTracks().length) {
    captured.getTracks().forEach((track) => track.stop());
    return { error: 'No audio was shared. Pick a tab, window or entire screen and turn on "Share audio" in the picker.' };
  }
  captured.getVideoTracks().forEach((track) => track.stop());
  useStream(new MediaStream(captured.getAudioTracks()), 'window');
  return { ok: true };
}

export async function captureMicrophone(): Promise<CaptureResult> {
  try {
    useStream(await navigator.mediaDevices.getUserMedia({ audio: UNPROCESSED }), 'mic');
    return { ok: true };
  } catch (error) {
    return { error: `Microphone blocked (${(error as Error).name}). Allow microphone access for this page and try again.` };
  }
}
