import { drawAsciiFire, flareAsciiFire } from './asciifire';
import { drawAsciiKnot, kickAsciiKnot } from './asciiknot';
import { drawAsciiPlasma, rippleAsciiPlasma } from './asciiplasma';
import { drawBars, dropBars } from './bars';
import { drawBlob } from './blob';
import { drawCells, kickCells, shatterCells } from './cells';
import { drawChladni, jumpChladni, stepChladni } from './chladni';
import { drawDancer, pulseDancer, switchDance } from './dancer';
import { drawDeepSpace, pulseDeepSpace } from './deepspace';
import { drawGallop, dropGallop, pulseGallop } from './gallop';
import { drawGalaxy } from './galaxy';
import { bloomGolden, drawGolden, twistGolden } from './golden';
import { drawGrid } from './grid';
import { drawHex } from './hex';
import { burstMatrix, drawMatrix, floodMatrix } from './matrix';
import { drawModel, pulseModel } from './model';
import { drawRadial } from './radial';
import { drawScope } from './scope';
import { claimSolarDrop, drawSolar, pulseSolar, solarBusy, solarHandoff } from './solar';
import { bumpTopo, drawTopo, quakeTopo } from './topo';
import { drawTruchet, flipTruchet, scrambleTruchet } from './truchet';
import { drawTunnel, spawnRing, spawnRingVolley } from './tunnel';
import { drawWarp } from './warp';
import { drawWaltz, dropWaltz, pulseWaltz } from './waltz';

export const MODE_GROUPS = ['Spectrum', 'Flight', 'Patterns', 'ASCII', 'Characters', '3D'] as const;

export type ModeGroup = (typeof MODE_GROUPS)[number];

export interface Mode {
  name: string;
  group: ModeGroup;
  description: string;
  draw: () => void;
  trails: boolean;
  fade: number;
  opaque: boolean;
  threeD: boolean;
  onBeat: () => void;
  onDrop: () => void;
  claimDrop: () => boolean;
  busy: () => boolean;
  handoff: () => string | undefined;
}

const defineMode = (name: string, group: ModeGroup, description: string, draw: () => void, options?: Partial<Mode>): Mode => ({
  name,
  group,
  description,
  draw,
  trails: true,
  fade: 0.22,
  opaque: false,
  threeD: false,
  onBeat: () => {},
  onDrop: () => {},
  claimDrop: () => false,
  busy: () => false,
  handoff: () => undefined,
  ...options,
});

export const MODES = [
  defineMode('Bars', 'Spectrum', 'Mirrored spectrum bars with falling peaks', drawBars, { onDrop: dropBars }),
  defineMode('Radial', 'Spectrum', 'Spectrum spokes radiating from a pulsing core', drawRadial),
  defineMode('Tunnel', 'Flight', 'Polygon rings fired down a tunnel on every beat', drawTunnel, { trails: false, onBeat: spawnRing, onDrop: spawnRingVolley }),
  defineMode('Scope', 'Spectrum', 'Layered oscilloscope traces of the waveform', drawScope, { trails: false, fade: 0.28 }),
  defineMode('Galaxy', 'Flight', 'A spiral of stars that swirls with the music', drawGalaxy),
  defineMode('Retro Grid', 'Flight', 'Synthwave sun over a scrolling neon grid', drawGrid, { trails: false, fade: 0.55, opaque: true }),
  defineMode('Warp', 'Flight', 'Hyperspace star streaks that thicken with energy', drawWarp),
  defineMode('Blob', 'Patterns', 'Nested organic shapes that breathe with the bass', drawBlob),
  defineMode('Hex', 'Patterns', 'A honeycomb lit by ripples on each beat', drawHex),
  defineMode('Deep Space', '3D', '3D flight through a glowing star field', drawDeepSpace, { trails: false, opaque: true, threeD: true, onBeat: pulseDeepSpace }),
  defineMode('Model', '3D', 'A 3D point-cloud asteroid orbited by the camera', drawModel, { trails: false, opaque: true, threeD: true, onBeat: pulseModel }),
  defineMode('Solar System', '3D', 'A cinematic 3D tour of the planets', drawSolar, { trails: false, opaque: true, threeD: true, onBeat: pulseSolar, claimDrop: claimSolarDrop, busy: solarBusy, handoff: solarHandoff }),
  defineMode('ASCII Knot', 'ASCII', 'A torus knot spun out of ASCII characters', drawAsciiKnot, { trails: false, fade: 0.5, onBeat: kickAsciiKnot }),
  defineMode('Matrix Rain', 'ASCII', 'Falling glyph columns that race with the energy', drawMatrix, { trails: false, fade: 0.35, onBeat: burstMatrix, onDrop: floodMatrix }),
  defineMode('Chladni', 'Patterns', 'Cymatic sand patterns that reshape on the beat', drawChladni, { trails: false, fade: 0.3, onBeat: stepChladni, onDrop: jumpChladni }),
  defineMode('Truchet', 'Patterns', 'A maze of arcs whose tiles flip on every beat', drawTruchet, { trails: false, fade: 0.4, onBeat: flipTruchet, onDrop: scrambleTruchet }),
  defineMode('ASCII Fire', 'ASCII', 'Glyph flames fed by the spectrum from below', drawAsciiFire, { trails: false, fade: 0.45, onDrop: flareAsciiFire }),
  defineMode('ASCII Plasma', 'ASCII', 'Interfering sine waves rendered in characters', drawAsciiPlasma, { trails: false, fade: 0.45, onBeat: rippleAsciiPlasma }),
  defineMode('Topo', 'Patterns', 'Contour lines over terrain that quakes on kicks', drawTopo, { trails: false, fade: 0.35, onBeat: bumpTopo, onDrop: quakeTopo }),
  defineMode('Cells', 'Patterns', 'Voronoi cells that scatter on the beat', drawCells, { trails: false, fade: 0.35, onBeat: kickCells, onDrop: shatterCells }),
  defineMode('Golden', 'Spectrum', 'A sunflower spiral whose seeds swell with the spectrum', drawGolden, { trails: false, fade: 0.4, onBeat: twistGolden, onDrop: bloomGolden }),
  defineMode('Dancer', 'Characters', 'A pixel-art dancer moving in time with the beat', drawDancer, { trails: false, fade: 0.4, onBeat: pulseDancer, onDrop: switchDance }),
  defineMode('Waltz', 'Characters', 'A flickering 1887 Muybridge film of a waltzing couple', drawWaltz, { trails: false, fade: 0.4, onBeat: pulseWaltz, onDrop: dropWaltz }),
  defineMode('Gallop', 'Characters', "Muybridge's race horse galloping down a numbered track", drawGallop, { trails: false, fade: 0.4, onBeat: pulseGallop, onDrop: dropGallop }),
];
