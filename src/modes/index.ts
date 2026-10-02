import { drawBars, dropBars } from './bars';
import { drawBlob } from './blob';
import { drawDeepSpace, pulseDeepSpace } from './deepspace';
import { drawGalaxy } from './galaxy';
import { drawGrid } from './grid';
import { drawHex } from './hex';
import { drawModel, pulseModel } from './model';
import { drawRadial } from './radial';
import { drawScope } from './scope';
import { claimSolarDrop, drawSolar, pulseSolar, solarBusy, solarHandoff } from './solar';
import { drawTunnel, spawnRing, spawnRingVolley } from './tunnel';
import { drawWarp } from './warp';

export interface Mode {
  name: string;
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

const defineMode = (name: string, description: string, draw: () => void, options?: Partial<Mode>): Mode => ({
  name,
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
  defineMode('Bars', 'Mirrored spectrum bars with falling peaks', drawBars, { onDrop: dropBars }),
  defineMode('Radial', 'Spectrum spokes radiating from a pulsing core', drawRadial),
  defineMode('Tunnel', 'Polygon rings fired down a tunnel on every beat', drawTunnel, { trails: false, onBeat: spawnRing, onDrop: spawnRingVolley }),
  defineMode('Scope', 'Layered oscilloscope traces of the waveform', drawScope, { trails: false, fade: 0.28 }),
  defineMode('Galaxy', 'A spiral of stars that swirls with the music', drawGalaxy),
  defineMode('Retro Grid', 'Synthwave sun over a scrolling neon grid', drawGrid, { trails: false, fade: 0.55, opaque: true }),
  defineMode('Warp', 'Hyperspace star streaks that thicken with energy', drawWarp),
  defineMode('Blob', 'Nested organic shapes that breathe with the bass', drawBlob),
  defineMode('Hex', 'A honeycomb lit by ripples on each beat', drawHex),
  defineMode('Deep Space', '3D flight through a glowing star field', drawDeepSpace, { trails: false, opaque: true, threeD: true, onBeat: pulseDeepSpace }),
  defineMode('Model', 'A 3D point-cloud asteroid orbited by the camera', drawModel, { trails: false, opaque: true, threeD: true, onBeat: pulseModel }),
  defineMode('Solar System', 'A cinematic 3D tour of the planets', drawSolar, { trails: false, opaque: true, threeD: true, onBeat: pulseSolar, claimDrop: claimSolarDrop, busy: solarBusy, handoff: solarHandoff }),
];
