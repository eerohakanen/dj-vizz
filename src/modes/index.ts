import { drawBars } from './bars';
import { drawBlob } from './blob';
import { drawDeepSpace, pulseDeepSpace } from './deepspace';
import { drawGalaxy } from './galaxy';
import { drawGrid } from './grid';
import { drawHex } from './hex';
import { drawHypno } from './hypno';
import { drawModel, pulseModel } from './model';
import { drawRadial } from './radial';
import { drawScope } from './scope';
import { drawTunnel, spawnRing } from './tunnel';
import { drawWarp } from './warp';

export interface Mode {
  name: string;
  draw: () => void;
  trails: boolean;
  fade: number;
  opaque: boolean;
  onBeat: () => void;
}

const defineMode = (name: string, draw: () => void, options?: Partial<Mode>): Mode => ({
  name,
  draw,
  trails: true,
  fade: 0.22,
  opaque: false,
  onBeat: () => {},
  ...options,
});

export const MODES = [
  defineMode('Bars', drawBars),
  defineMode('Radial', drawRadial),
  defineMode('Tunnel', drawTunnel, { onBeat: spawnRing }),
  defineMode('Scope', drawScope, { trails: false, fade: 0.28 }),
  defineMode('Galaxy', drawGalaxy),
  defineMode('Retro Grid', drawGrid, { trails: false, fade: 0.55, opaque: true }),
  defineMode('Warp', drawWarp),
  defineMode('Blob', drawBlob),
  defineMode('Hex', drawHex),
  defineMode('Hypno', drawHypno),
  defineMode('Deep Space', drawDeepSpace, { trails: false, opaque: true, onBeat: pulseDeepSpace }),
  defineMode('Model', drawModel, { trails: false, opaque: true, onBeat: pulseModel }),
];
