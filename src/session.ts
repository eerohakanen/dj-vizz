import { CHANGE_OPTIONS } from './app/labels';
import { audio, type AudioSourceKind } from './audio/input';
import { isNumber, isRecord } from './lib/utils';
import { clamp } from './math';
import { playlist, readPreset, resolveLook, snapshot } from './presets/library';
import { settings } from './state';
import { subscribe } from './store';
import { CALIBRATION_CONTROLS } from './tuning';

const CALIBRATION_KEY = 'djviz.calibration.v1';
const SESSION_KEY = 'djviz.session.v1';
const SAVE_DELAY_MS = 500;

let lastSource: AudioSourceKind | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const written = new Map<string, string>();

export const lastAudioSource = () => lastSource;

function read(key: string) {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return isRecord(stored) ? stored : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  const json = JSON.stringify(value);
  if (written.get(key) === json) return;
  try {
    localStorage.setItem(key, json);
    written.set(key, json);
  } catch {}
}

const calibrationSnapshot = () => ({
  autoGain: settings.autoGain,
  ...Object.fromEntries(CALIBRATION_CONTROLS.map(({ key }) => [key, settings[key]])),
});

const sessionSnapshot = () => ({
  look: snapshot(''),
  auto: settings.auto,
  changeOn: playlist.changeOn,
  shuffle: playlist.shuffle,
  source: lastSource,
});

export function saveSession() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  write(CALIBRATION_KEY, calibrationSnapshot());
  write(SESSION_KEY, sessionSnapshot());
}

function scheduleSave() {
  if (audio.source) lastSource = audio.source;
  saveTimer ??= setTimeout(saveSession, SAVE_DELAY_MS);
}

function restoreCalibration(stored: Record<string, unknown>) {
  if (typeof stored.autoGain === 'boolean') settings.autoGain = stored.autoGain;
  for (const { key, min, max } of CALIBRATION_CONTROLS) {
    const value = stored[key];
    if (isNumber(value)) settings[key] = clamp(value, min, max);
  }
}

function restoreLook(stored: Record<string, unknown>) {
  if (isRecord(stored.look)) Object.assign(settings, resolveLook(readPreset(stored.look)));
  if (typeof stored.auto === 'boolean') settings.auto = stored.auto;
  const changeOn = CHANGE_OPTIONS.find(({ value }) => value === stored.changeOn);
  if (changeOn) playlist.changeOn = changeOn.value;
  if (typeof stored.shuffle === 'boolean') playlist.shuffle = stored.shuffle;
  if (stored.source === 'window' || stored.source === 'mic') lastSource = stored.source;
}

export function restoreSession() {
  const calibration = read(CALIBRATION_KEY);
  if (calibration) restoreCalibration(calibration);
  const session = read(SESSION_KEY);
  if (session) restoreLook(session);
  subscribe(scheduleSave);
}
