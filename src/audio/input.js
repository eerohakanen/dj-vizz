import { showMessage } from '../dom.js';

const UNPROCESSED = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

export const audio = {
  analyser: null,
  frequencies: new Uint8Array(1024),
  waveform: new Uint8Array(2048),
  live: false,
};

let context;
let source;
let stream;
let fileElement;

function ensureContext() {
  if (!context) {
    context = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.7;
    audio.analyser = analyser;
    audio.frequencies = new Uint8Array(analyser.frequencyBinCount);
    audio.waveform = new Uint8Array(analyser.fftSize);
  }
  if (context.state === 'suspended') context.resume();
}

function stopInput() {
  try {
    source?.disconnect();
  } catch {}
  source = null;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  fileElement?.pause();
  audio.live = false;
}

function useStream(mediaStream, label) {
  stopInput();
  ensureContext();
  stream = mediaStream;
  source = context.createMediaStreamSource(mediaStream);
  source.connect(audio.analyser);
  audio.live = true;
  showMessage(label);
  mediaStream.getTracks().forEach((track) => {
    track.onended = () => {
      audio.live = false;
      showMessage('Audio source ended.');
    };
  });
}

export async function captureTab() {
  try {
    const captured = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: UNPROCESSED });
    if (!captured.getAudioTracks().length) {
      captured.getTracks().forEach((track) => track.stop());
      showMessage('No audio shared. Choose a Chrome/Edge tab (or Entire Screen on Windows) and tick "Share audio".');
      return;
    }
    captured.getVideoTracks().forEach((track) => track.stop());
    useStream(new MediaStream(captured.getAudioTracks()), 'Listening to shared audio ✔');
  } catch (error) {
    showMessage(`Could not capture audio (${error.name}). If embedded, open this page in its own browser tab. Or use Mic / File.`);
  }
}

export async function captureMicrophone() {
  try {
    useStream(await navigator.mediaDevices.getUserMedia({ audio: UNPROCESSED }), 'Listening to microphone ✔');
  } catch (error) {
    showMessage(`Microphone blocked (${error.name}). Open in its own tab and allow access.`);
  }
}

export function playFile(file) {
  stopInput();
  ensureContext();
  if (!fileElement) {
    fileElement = new Audio();
    fileElement.loop = true;
    const node = context.createMediaElementSource(fileElement);
    node.connect(audio.analyser);
    node.connect(context.destination);
  }
  fileElement.src = URL.createObjectURL(file);
  fileElement.play();
  audio.live = true;
  showMessage(`Playing ${file.name}`);
}
