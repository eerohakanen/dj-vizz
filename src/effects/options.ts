export const MIRROR_NAMES = ['Off', 'Mirror', 'Quad', 'Kaleido'] as const;
export const PSY_NAMES = ['Off', 'Vortex', 'Liquid', 'Rainbow', 'Trip'] as const;

export type MirrorName = (typeof MIRROR_NAMES)[number];
export type PsyName = (typeof PSY_NAMES)[number];

export const mirrorIndex = (name: MirrorName) => MIRROR_NAMES.indexOf(name);
export const psyIndex = (name: PsyName) => PSY_NAMES.indexOf(name);
