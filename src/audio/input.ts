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
  external: false,
  source: null as AudioSourceKind | null,
  lost: null as AudioSourceKind | null,
  inputDevice: '',
};

declare global {
  class CaptureController {
    setFocusBehavior(behavior: 'focus-captured-surface' | 'no-focus-change'): void;
  }
}

let context: AudioContext | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let stream: MediaStream | null = null;
let captureTicket = 0;

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

function startCapture() {
  const ticket = ++captureTicket;
  return () => ticket === captureTicket;
}

function stopTracks(mediaStream: MediaStream) {
  mediaStream.getTracks().forEach((track) => track.stop());
}

export function disconnectAudio() {
  captureTicket++;
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

type CaptureResult =
  | { ok: true; error?: undefined; superseded?: undefined }
  | { ok?: false; error: string; superseded?: undefined }
  | { ok?: false; error?: undefined; superseded: true };

const SUPERSEDED = { superseded: true } as const;

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
  const isCurrent = startCapture();
  const controller = createCaptureController();
  let captured: MediaStream;
  try {
    captured = await navigator.mediaDevices.getDisplayMedia({ ...DISPLAY_CAPTURE, controller } as DisplayMediaStreamOptions);
  } catch (error) {
    if (!isCurrent()) return SUPERSEDED;
    const name = (error as Error).name;
    if (name === 'NotAllowedError') return { error: 'Sharing cancelled.' };
    return { error: `Could not capture audio (${name}). If embedded, open this page in its own browser tab.` };
  }
  if (!isCurrent()) {
    stopTracks(captured);
    return SUPERSEDED;
  }
  keepFocusHere(controller);
  if (!captured.getAudioTracks().length) {
    stopTracks(captured);
    return { error: 'No audio was shared. Pick a tab, window or entire screen and turn on "Share audio" in the picker.' };
  }
  captured.getVideoTracks().forEach((track) => track.stop());
  useStream(new MediaStream(captured.getAudioTracks()), 'window');
  return { ok: true };
}

const PSEUDO_DEVICES = new Set(['', 'default', 'communications']);

export async function listInputDevices() {
  const devices = (await navigator.mediaDevices?.enumerateDevices?.()) ?? [];
  const inputs = devices.filter((device) => device.kind === 'audioinput' && !PSEUDO_DEVICES.has(device.deviceId));
  return inputs.every((device) => device.label) ? inputs : [];
}

const microphoneConstraints = (deviceId: string) => ({
  audio: deviceId ? { ...UNPROCESSED, deviceId: { exact: deviceId } } : UNPROCESSED,
});

const MISSING_DEVICE_ERRORS = new Set(['OverconstrainedError', 'NotFoundError']);

async function openMicrophone(deviceId: string) {
  try {
    return await navigator.mediaDevices.getUserMedia(microphoneConstraints(deviceId));
  } catch (error) {
    if (!deviceId || !MISSING_DEVICE_ERRORS.has((error as Error).name)) throw error;
    return navigator.mediaDevices.getUserMedia(microphoneConstraints(''));
  }
}

export async function captureMicrophone(): Promise<CaptureResult> {
  const isCurrent = startCapture();
  try {
    const captured = await openMicrophone(audio.inputDevice);
    if (!isCurrent()) {
      stopTracks(captured);
      return SUPERSEDED;
    }
    useStream(captured, 'mic');
    return { ok: true };
  } catch (error) {
    if (!isCurrent()) return SUPERSEDED;
    return { error: `Microphone blocked (${(error as Error).name}). Allow microphone access for this page and try again.` };
  }
}

export async function selectInputDevice(deviceId: string): Promise<CaptureResult | undefined> {
  audio.inputDevice = deviceId;
  notify();
  if (audio.source === 'mic') return captureMicrophone();
}
