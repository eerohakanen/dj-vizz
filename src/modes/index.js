import { drawBars } from './bars.js';
import { drawBlob } from './blob.js';
import { drawDeepSpace, pulseDeepSpace } from './deepspace.js';
import { drawGalaxy } from './galaxy.js';
import { drawGrid } from './grid.js';
import { drawHex } from './hex.js';
import { drawHypno } from './hypno.js';
import { drawRadial } from './radial.js';
import { drawScope } from './scope.js';
import { drawTunnel, spawnRing } from './tunnel.js';
import { drawWarp } from './warp.js';

const defineMode = (name, draw, options) => ({
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
];
