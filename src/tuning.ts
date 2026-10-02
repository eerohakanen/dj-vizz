import { TUNING_DEFAULTS } from './state';
import type { LiveMode } from './store';

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

export type TuningGroup = 'global' | 'mode';

interface TuningSection {
  title: string;
  group: TuningGroup;
  placement?: 'effects';
  whilePlaying?: true;
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
    group: 'global',
    whilePlaying: true,
    description: 'What the visualizer hears.',
    controls: [GAIN_CONTROL],
  },
  {
    title: 'Detection',
    group: 'global',
    whilePlaying: true,
    description: 'What counts as a hit or a drop.',
    controls: [
      {
        key: 'beatSensitivity',
        label: 'Beat detection',
        min: 0.2,
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
          'How readily a build-up followed by a heavy return fires an automatic drop: shockwaves and a mode change if Auto-switch is on. Off means drops only fire from the Drop button.',
      },
    ],
  },
  {
    title: 'Response',
    group: 'global',
    description: 'How strongly the visuals react to what is heard.',
    controls: [
      {
        key: 'reactivity',
        label: 'Overall intensity',
        min: 0.1,
        max: 3,
        step: 0.1,
        format: multiplier,
        description: 'Master strength for every mode. One knob to make the whole show calmer or wilder.',
      },
      {
        key: 'contrast',
        label: 'Sensitivity to change',
        min: 0,
        max: 1,
        step: 0.05,
        format: percentOf(0, 1),
        description:
          'How strongly small changes in the music swing the visuals. High values exaggerate every shift; zero follows raw loudness.',
      },
    ],
  },
  {
    title: 'Movement',
    group: 'mode',
    description: 'How this mode moves with the music.',
    controls: [
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
        key: 'colorSpeed',
        label: 'Colour speed',
        min: 0,
        max: 2,
        step: 0.05,
        format: multiplier,
        description: 'How far colours move through the palette on each beat and drop. Zero keeps colours steady.',
      },
    ],
  },
  {
    title: 'Pixelate',
    group: 'global',
    placement: 'effects',
    description: 'How the picture breaks into pixels while Pixelate is on.',
    controls: [
      {
        key: 'pixelSize',
        label: 'Size',
        min: 4,
        max: 48,
        step: 1,
        format: (value) => `${value}px`,
        description: 'Width of each pixel on screen. Bigger pixels make a chunkier, more abstract picture.',
      },
      {
        key: 'pixelGap',
        label: 'Spacing',
        min: 0,
        max: 0.6,
        step: 0.01,
        format: percentOf(0, 1),
        description: 'Dark gap between neighbouring pixels, as a share of the pixel size. Wide gaps give an LED-wall look.',
      },
    ],
  },
] satisfies TuningSection[];

type SectionIn<G extends TuningGroup> = Extract<(typeof TUNING_SECTIONS)[number], { group: G }>;

export type ModeTuningKey = SectionIn<'mode'>['controls'][number]['key'];
export type GlobalTuningKey = Exclude<TuningKey, ModeTuningKey>;

interface GroupControl<K extends TuningKey> extends TuningControl {
  key: K;
}

const controlsIn = <K extends TuningKey>(group: TuningGroup) =>
  TUNING_SECTIONS.filter((section) => section.group === group).flatMap((section) => section.controls) as GroupControl<K>[];

export const MODE_CONTROLS = controlsIn<ModeTuningKey>('mode');
export const GLOBAL_CONTROLS = controlsIn<GlobalTuningKey>('global');

export const EFFECT_CONTROLS = Object.fromEntries(
  TUNING_SECTIONS.filter((section) => section.placement === 'effects').flatMap((section) => section.controls.map((control) => [control.key, control])),
) as Record<'pixelSize' | 'pixelGap', TuningControl>;

export const tuningSectionsFor = (mode: LiveMode) =>
  TUNING_SECTIONS.filter((section) => (mode === 'play' ? 'whilePlaying' in section : section.placement !== 'effects'));
