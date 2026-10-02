import { audio } from './audio/input';
import { isNumber, isRecord } from './lib/utils';
import { clamp } from './math';
import { readPreset, resolveLook, snapshot } from './presets/library';
import { settings } from './state';
import { subscribe } from './store';
import { CALIBRATION_CONTROLS } from './tuning';

const CALIBRATION_KEY = 'djviz.calibration.v1';
const SESSION_KEY = 'djviz.session.v2';
const LEGACY_SESSION_KEY = 'djviz.session.v1';
const LEGACY_LOOK_VERSION = 4;
const SAVE_DELAY_MS = 500;

let saveTimer: ReturnType<typeof setTimeout> | undefined;
const written = new Map<string, string>();

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
  inputDevice: audio.inputDevice,
  ...Object.fromEntries(CALIBRATION_CONTROLS.map(({ key }) => [key, settings[key]])),
});

const sessionSnapshot = () => ({
  look: snapshot(''),
  auto: settings.auto,
});

export function saveSession() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  write(CALIBRATION_KEY, calibrationSnapshot());
  write(SESSION_KEY, sessionSnapshot());
}

function scheduleSave() {
  saveTimer ??= setTimeout(saveSession, SAVE_DELAY_MS);
}

function restoreCalibration(stored: Record<string, unknown>) {
  if (typeof stored.autoGain === 'boolean') settings.autoGain = stored.autoGain;
  if (typeof stored.inputDevice === 'string') audio.inputDevice = stored.inputDevice;
  for (const { key, min, max } of CALIBRATION_CONTROLS) {
    const value = stored[key];
    if (isNumber(value)) settings[key] = clamp(value, min, max);
  }
}

function restoreLook(stored: Record<string, unknown>, version?: number) {
  if (isRecord(stored.look)) Object.assign(settings, resolveLook(readPreset(stored.look, version)));
  if (typeof stored.auto === 'boolean') settings.auto = stored.auto;
}

export function restoreSession() {
  const calibration = read(CALIBRATION_KEY);
  if (calibration) restoreCalibration(calibration);
  const session = read(SESSION_KEY);
  const legacySession = session ? null : read(LEGACY_SESSION_KEY);
  if (session) restoreLook(session);
  else if (legacySession) restoreLook(legacySession, LEGACY_LOOK_VERSION);
  subscribe(scheduleSave);
}
