export const AUDIO_SOURCE_KINDS = ['window', 'mic'] as const;

export type AudioSourceKind = (typeof AUDIO_SOURCE_KINDS)[number];

export const isAudioSourceKind = (value: unknown): value is AudioSourceKind =>
  AUDIO_SOURCE_KINDS.some((kind) => kind === value);
