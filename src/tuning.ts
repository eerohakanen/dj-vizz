import { TUNING_DEFAULTS } from './state';

export type TuningKey = Exclude<keyof typeof TUNING_DEFAULTS, 'autoGain'>;

export interface TuningControl {
  key: TuningKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  description: string;
}

export type TuningGroup = 'calibration' | 'look';

interface TuningSection {
  title: string;
  group: TuningGroup;
  description: string;
  controls: TuningControl[];
}

const multiplier = (value: number) => `×${value.toFixed(2)}`;
const percentOf = (min: number, max: number) => (value: number) => `${Math.round(((value - min) / (max - min)) * 100)}%`;

export const GAIN_CONTROL: TuningControl = {
  key: 'gain',
  label: 'Input level',
  min: 0,
  max: 100,
  step: 1,
  format: (value) => String(value),
  description:
    'How loud the music sounds to the visualizer. Raise it if the visuals barely move, lower it if everything looks maxed out. Auto level adjusts this for you.',
};

export const TUNING_SECTIONS = [
  {
    title: 'Input',
    group: 'calibration',
    description: 'What the visualizer hears.',
    controls: [
      GAIN_CONTROL,
      {
        key: 'noiseGate',
        label: 'Silence threshold',
        min: 0,
        max: 0.15,
        step: 0.005,
        format: percentOf(0, 0.15),
        description:
          'Anything quieter than this counts as silence and the visuals rest. Raise it if room noise or hiss keeps things moving between tracks.',
      },
    ],
  },
  {
    title: 'Detection',
    group: 'calibration',
    description: 'What counts as a hit or a drop.',
    controls: [
      {
        key: 'beatSensitivity',
        label: 'Beat detection',
        min: 0.5,
        max: 2,
        step: 0.05,
        format: multiplier,
        description:
          'How easily kicks, snares and hi-hats register as hits. Raise it if beats are missed, lower it if the visuals twitch on every sound.',
      },
      {
        key: 'dropSensitivity',
        label: 'Drop detection',
        min: 0,
        max: 2,
        step: 0.05,
        format: (value) => (value === 0 ? 'Off' : multiplier(value)),
        description:
          'How readily a build-up followed by a heavy return fires an automatic drop: big flash, shockwaves and a mode change if Auto-switch is on. Off means drops only fire from the Drop button.',
      },
    ],
  },
  {
    title: 'Response',
    group: 'look',
    description: 'How strongly the visuals react to what is heard.',
    controls: [
      {
        key: 'reactivity',
        label: 'Overall intensity',
        min: 0.5,
        max: 3,
        step: 0.1,
        format: multiplier,
        description: 'Master strength for everything below. One knob to make the whole show calmer or wilder.',
      },
      {
        key: 'motion',
        label: 'Motion speed',
        min: 0,
        max: 2,
        step: 0.05,
        format: multiplier,
        description: 'How fast shapes spin, scroll and fly forward as the music gets louder.',
      },
      {
        key: 'punch',
        label: 'Beat punch',
        min: 0,
        max: 2,
        step: 0.05,
        format: multiplier,
        description: 'How much the picture zooms and shakes on kicks, beats and drops.',
      },
      {
        key: 'flashes',
        label: 'Flash brightness',
        min: 0,
        max: 1,
        step: 0.05,
        format: percentOf(0, 1),
        description: 'Brightness of snare flashes, drop flashes and the strobe. Turn it down if flashing light is uncomfortable.',
      },
      {
        key: 'particles',
        label: 'Particles',
        min: 0,
        max: 2,
        step: 0.05,
        format: multiplier,
        description: 'How many sparks burst out on beats, hi-hats and drops.',
      },
      {
        key: 'colorSpeed',
        label: 'Colour speed',
        min: 0,
        max: 2,
        step: 0.05,
        format: multiplier,
        description: 'How far colours move through the palette on each beat and drop. Zero keeps colours steady.',
      },
      {
        key: 'trailLength',
        label: 'Trail length',
        min: 0.8,
        max: 0.95,
        step: 0.005,
        format: percentOf(0.8, 0.95),
        description: 'How long motion trails linger while Trails is on. Longer trails smear movement into streaks.',
      },
    ],
  },
] satisfies TuningSection[];

type SectionIn<G extends TuningGroup> = Extract<(typeof TUNING_SECTIONS)[number], { group: G }>;

export type LookTuningKey = SectionIn<'look'>['controls'][number]['key'];
export type CalibrationTuningKey = Exclude<TuningKey, LookTuningKey>;

interface GroupControl<K extends TuningKey> extends TuningControl {
  key: K;
}

const controlsIn = <K extends TuningKey>(group: TuningGroup) =>
  TUNING_SECTIONS.filter((section) => section.group === group).flatMap((section) => section.controls) as GroupControl<K>[];

export const LOOK_CONTROLS = controlsIn<LookTuningKey>('look');
export const CALIBRATION_CONTROLS = controlsIn<CalibrationTuningKey>('calibration');
