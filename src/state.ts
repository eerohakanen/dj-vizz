export const view = {
  width: 2,
  height: 2,
  diagonal: 3,
  minSide: 2,
  pixelRatio: 1,
  quality: 1,
};

export const clock = {
  time: 0,
  delta: 0.016,
};

export const TUNING_DEFAULTS = {
  autoGain: true,
  gain: 55,
  beatSensitivity: 1,
  dropSensitivity: 1,
  reactivity: 1,
  contrast: 0.7,
  motion: 1,
  punch: 1,
  colorSpeed: 1,
  pixelSize: 12,
  pixelGap: 0.15,
};

export const settings = {
  mode: 0,
  palette: 1,
  psy: 0,
  mirror: 0,
  pixelate: 0,
  lasers: false,
  auto: false,
  ...TUNING_DEFAULTS,
};

export const signal = {
  bass: 0,
  mid: 0,
  high: 0,
  bassAverage: 0,
  punchBass: 0,
  punchMid: 0,
  punchHigh: 0,
  gate: 0,
  energy: 0,
  energySlow: 0,
  energyPeak: 0,
  breakdown: 0,
  gainFactor: 1,
  lastBeat: 0,
  lastDrop: -9,
  bpm: 0,
  tempoConfidence: 0,
  beatInBar: 0,
  beatPhase: 0,
  barPhase: 0,
  downbeat: false,
  phraseBeat: 0,
  tension: 0,
  brightness: 0.5,
  key: -1,
  keyConfidence: 0,
  vocal: 0,
};

export const impulse = {
  hue: 0,
  beat: 0,
  kick: 0,
  snare: 0,
  hat: 0,
};

export const fx = {
  hue: 0,
  beat: 0,
  kick: 0,
  snare: 0,
  hat: 0,
  keyHue: 0,
  drop: 0,
  calm: 0,
  shake: 0,
  spin: 0,
  scroll: 0,
  vortexDirection: 1,
  laserMix: 0,
  vortexMix: 0,
  liquidMix: 0,
  rainbowMix: 0,
  tripMix: 0,
};

export const INTENSITY_SCALE = 0.2;

export const intensity = () => settings.reactivity * INTENSITY_SCALE;
