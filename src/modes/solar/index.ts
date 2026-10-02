import type * as Three from 'three';
import { tensionPeak } from '../../audio/musical';
import { BEATS_PER_BAR } from '../../audio/tempo';
import { fillWith, sceneCtx } from '../../canvas';
import { clamp01, smoothstep } from '../../math';
import { flashLevel, motionScale } from '../../motion';
import { clock, fx, settings, signal } from '../../state';
import { advanceSway, cameraJitter, createKick, fitStage, lazyStage, paint, paintPalette, presentStage, sway } from '../three-stage';
import { loadModules } from './assets';
import { animateBlackHole, clearBlackHole } from './blackhole';
import { BODIES } from './bodies';
import {
  busy,
  cataclysmPose,
  createCataclysm,
  displace,
  ignite,
  phaseLevel,
  pullLevel,
  resetCataclysm,
  shockRadius,
  shouldIgnite,
  stepCataclysm,
  UNLOCKED_BAR_SECONDS,
} from './cataclysm';
import { BASE_FOV, buildStage, type SolarStage } from './scene';
import {
  add,
  bezier,
  canEclipse,
  distance,
  eclipse,
  eclipseCoverage,
  keepClear,
  type Pose,
  scale,
  SHOTS,
  shotsFor,
  sub,
  type Vec,
} from './shots';
import { animateSupernova, clearSupernova } from './supernova';
import { createTour, eclipseProgress, eclipsing, lookEase, stepTour, traveling, warpLevel } from './tour';

const CRUISE_SECONDS = 5;
const JUMP_SECONDS = 1.5;
const ECLIPSE_BEATS = 16;
const UNLOCKED_ECLIPSE_SECONDS = 8;
const TANGENT_STEP = 0.05;
const VERTIGO = 0.45;
const WARP_FOV = 28;
const JUMP_FOV = 45;
const WHITE_OUT = 0.85;
const STREAK_LENGTH = 0.08;
const STREAK_MIN_SPEED = 5;
const STREAK_FULL_SPEED = 45;
const DIVE_FOV = 50;
const REJOIN_GAP = 0.5;

interface Route {
  p0: Vec;
  p1: Vec;
  p2: Vec;
  p3: Vec;
  look0: Vec;
  look3: Vec;
}

const solar = lazyStage(() => loadModules().then(buildStage));
const kick = createKick();
const tour = createTour();
const cataclysm = createCataclysm();
let lastDrawn = -Infinity;
let shotClock = 0;
let lastCuts = 0;
let lastLeg = 0;
let dropping = false;
let lastPhraseBeat = 0;
let coronaFlare = 0;
let route: Route | undefined;

function dropStarted() {
  if (fx.drop > 0.9 && !dropping) {
    dropping = true;
    return true;
  }
  if (fx.drop < 0.5) dropping = false;
  return false;
}

const beatSeconds = (beats: number, fallback: number) => (signal.bpm > 0 ? (beats * 60) / signal.bpm : fallback);

function advanceTour() {
  const motion = motionScale();
  const phraseEnded = signal.phraseBeat === 0 && lastPhraseBeat !== 0;
  lastPhraseBeat = signal.phraseBeat;
  const body = BODIES[tour.to];
  stepTour(
    tour,
    {
      delta: clock.delta,
      drop: dropStarted(),
      phraseEnded,
      downbeat: signal.downbeat,
      calm: fx.calm,
      tempoLocked: signal.bpm > 0,
      cruiseSeconds: CRUISE_SECONDS / Math.sqrt(motion),
      jumpSeconds: JUMP_SECONDS / Math.sqrt(motion),
      eclipseSeconds: beatSeconds(ECLIPSE_BEATS, UNLOCKED_ECLIPSE_SECONDS),
      canEclipse: canEclipse(body),
      shotCount: shotsFor(body).length,
    },
    BODIES.length,
  );
}

function shotContext(stage: SolarStage, index: number) {
  const body = BODIES[index];
  return { body, center: stage.centers[index], parent: body.parent === undefined ? undefined : stage.centers[body.parent] };
}

function stopPose(stage: SolarStage, t: number): Pose {
  const context = shotContext(stage, tour.to);
  if (eclipsing(tour)) return eclipse(context, eclipseProgress(tour));
  return SHOTS[shotsFor(context.body)[tour.shot]](context, t);
}

function planRoute(stage: SolarStage) {
  const { camera, velocity, lookTarget } = stage;
  const context = shotContext(stage, tour.to);
  const shot = SHOTS[shotsFor(context.body)[0]];
  const arrival = shot(context, 0);
  const ahead = shot(context, TANGENT_STEP);
  const reach = tour.travelSeconds / 3;
  const p0 = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
  const span = distance(p0, arrival.position) / 3;
  const departure = scale(velocity, reach);
  const departureLength = Math.hypot(departure.x, departure.y, departure.z);
  const p1 = add(p0, departureLength > span ? scale(departure, span / departureLength) : departure);
  const p2 = sub(arrival.position, scale(sub(ahead.position, arrival.position), reach / TANGENT_STEP));
  route = { p0, p1, p2, p3: arrival.position, look0: { x: lookTarget.x, y: lookTarget.y, z: lookTarget.z }, look3: arrival.look };
}

function travelPose(stage: SolarStage): Pose {
  const { p0, p1, p2, p3, look0, look3 } = route!;
  const position = keepClear(bezier(p0, p1, p2, p3, tour.travel), stage.centers, [tour.from, tour.to]);
  return { position, look: add(look0, sub(look3, look0), lookEase(tour)) };
}

function applyVertigo(camera: Three.PerspectiveCamera, look: Vec, motion: number) {
  const fov = BASE_FOV * (1 - VERTIGO * signal.tension * motion);
  const pull = Math.tan((BASE_FOV * Math.PI) / 360) / Math.tan((fov * Math.PI) / 360);
  camera.position.set(look.x + (camera.position.x - look.x) * pull, look.y + (camera.position.y - look.y) * pull, look.z + (camera.position.z - look.z) * pull);
  return fov;
}

function moveCamera(stage: SolarStage) {
  const { camera, lookTarget } = stage;
  const { delta } = clock;
  const motion = motionScale();
  advanceSway();
  if (tour.leg !== lastLeg) {
    lastLeg = tour.leg;
    planRoute(stage);
    shotClock = 0;
  }
  const cut = tour.cuts !== lastCuts;
  lastCuts = tour.cuts;
  if (cut && !traveling(tour)) shotClock = 0;
  const moving = traveling(tour) && route !== undefined;
  if (!moving) shotClock += delta * (0.6 + signal.energy * 0.8) * settings.motion;
  const pose = moving ? travelPose(stage) : stopPose(stage, shotClock);
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  lookTarget.set(pose.look.x, pose.look.y, pose.look.z);
  const fov = moving ? BASE_FOV : applyVertigo(camera, pose.look, motion);
  const jitter = cameraJitter(0.05 * motion);
  camera.position.x += jitter();
  camera.position.y += jitter();
  camera.lookAt(lookTarget);
  camera.rotation.z += (fx.spin * 0.1 + sway(0.07, 1) * 0.04) * motion;
  const warp = warpLevel(tour) * (tour.jumping ? JUMP_FOV : WARP_FOV);
  camera.fov = fov + (kick.value * 4 + warp + fx.drop * 10) * motion;
  camera.updateProjectionMatrix();
  trackVelocity(stage, cut && !moving);
}

function trackVelocity(stage: SolarStage, cut: boolean) {
  const { camera, previous, velocity } = stage;
  if (cut) velocity.set(0, 0, 0);
  else if (clock.delta > 0) velocity.subVectors(camera.position, previous).divideScalar(clock.delta);
  previous.copy(camera.position);
}

function moveCataclysmCamera(stage: SolarStage) {
  const { camera, lookTarget } = stage;
  const motion = motionScale();
  const dive = phaseLevel(cataclysm, 'dive');
  const pose = cataclysmPose(cataclysm);
  advanceSway();
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  lookTarget.set(pose.look.x, pose.look.y, pose.look.z);
  const jitter = cameraJitter(0.4 * motion);
  camera.position.x += jitter();
  camera.position.y += jitter();
  camera.lookAt(lookTarget);
  camera.rotation.z += (fx.spin * 0.1 + sway(0.07, 1) * 0.04 + dive * dive * 2) * motion;
  camera.fov = BASE_FOV + (kick.value * 4 + fx.drop * 10 + dive * dive * DIVE_FOV) * motion;
  camera.updateProjectionMatrix();
  trackVelocity(stage, false);
}

function currentCoverage(stage: SolarStage) {
  const index = tour.to;
  if (!canEclipse(BODIES[index])) return 0;
  return eclipseCoverage(stage.camera.position, stage.centers[index], BODIES[index].radius);
}

function animateBodies(stage: SolarStage) {
  const { time, delta } = clock;
  const { gate, punchBass, mid, high } = signal;
  const motion = motionScale();
  for (const { body, spinner, clouds, rim, swirl, ripple, aurora } of stage.planets) {
    spinner.rotation.y = time * body.spin;
    if (clouds) clouds.rotation.y = time * body.spin * 1.2;
    if (rim) rim.uniforms.uIntensity.value = 0.4 + mid * 1.2 + kick.value * 0.3;
    if (swirl) {
      swirl.uSwirl.value += (0.1 + mid * 1.5) * delta * motion;
      swirl.uWobble.value = 0.3 + mid * 1.5;
    }
    if (ripple) {
      ripple.uRipple.value += (2 + fx.kick * 6) * delta;
      ripple.uRippleAmount.value = fx.kick * 0.03 * motion;
    }
    if (aurora) {
      aurora.uTime.value = time;
      aurora.uIntensity.value = 0.15 + fx.hat * 1.5;
    }
  }
  stage.sun.rotation.y = time * BODIES[0].spin;
  const sunLevel = 1 + gate * punchBass * 0.6 + kick.value * 0.3;
  (stage.sun.material as Three.MeshBasicMaterial).color.setRGB(sunLevel, sunLevel * 0.95, sunLevel * 0.85);
  stage.sunlight.intensity = 3 + gate * punchBass * 1.5 + kick.value;
  coronaFlare += fx.snare * delta * 6 * motion;
  const coverage = currentCoverage(stage);
  const { uniforms } = stage.corona;
  uniforms.uTime.value = time;
  uniforms.uSpin.value = fx.spin + coronaFlare;
  uniforms.uRadius.value = BODIES[0].radius * 4 * (1 + (fx.snare * 0.35 + coverage * 0.5) * motion);
  uniforms.uIntensity.value = 0.8 + punchBass * 0.8 + kick.value * 0.5 + fx.drop + fx.snare * 1.2 + coverage * 2.5;
  paint(stage, uniforms.uColor.value, 0, 62);
  if (stage.skyMaterial.map) stage.skyMaterial.color.setScalar((0.35 + high * 0.4 + kick.value * 0.1) * (1 - coverage * 0.5));
  stage.sky.position.copy(stage.camera.position);
}

function spinAsteroids(stage: SolarStage) {
  const { asteroids, belt, scratch } = stage;
  const burst = fx.kick * 0.6 * motionScale();
  const exploding = busy(cataclysm);
  const shock = shockRadius(cataclysm);
  const pull = pullLevel(cataclysm);
  asteroids.forEach((asteroid, i) => {
    scratch.position.copy(asteroid.position).addScaledVector(asteroid.push, burst);
    if (exploding) {
      const point = displace(scratch.position, shock, pull);
      scratch.position.set(point.x, point.y, point.z);
    }
    scratch.quaternion.setFromAxisAngle(asteroid.axis, clock.time * asteroid.spin * (exploding ? 4 : 1));
    scratch.scale.setScalar(asteroid.scale * (1 - pull));
    scratch.updateMatrix();
    belt.setMatrixAt(i, scratch.matrix);
  });
  belt.instanceMatrix.needsUpdate = true;
}

function updateStreaks(stage: SolarStage) {
  const { streaks, streakUniforms, camera, velocity } = stage;
  const speed = velocity.length();
  streaks.position.copy(camera.position);
  streakUniforms.uOffset.value.copy(camera.position);
  if (speed > 0) streakUniforms.uHeading.value.copy(velocity).divideScalar(speed);
  streakUniforms.uStreak.value = speed * STREAK_LENGTH;
  const jump = tour.jumping ? warpLevel(tour) : 0;
  const dive = phaseLevel(cataclysm, 'dive');
  streakUniforms.uStreakAlpha.value = Math.max(clamp01((speed - STREAK_MIN_SPEED) / STREAK_FULL_SPEED), jump, dive) * motionScale();
  paintPalette(stage, streakUniforms.uColorA.value, streakUniforms.uColorB.value);
}

function whiteOutLevel() {
  const dive = smoothstep(clamp01((phaseLevel(cataclysm, 'dive') - 0.7) / 0.3));
  const jump = tour.jumping && traveling(tour) ? warpLevel(tour) ** 8 * WHITE_OUT : 0;
  return Math.max(dive, jump) * flashLevel();
}

function whiteOut() {
  const level = whiteOutLevel();
  if (level < 0.01) return;
  fillWith(sceneCtx, 'lighter', `rgba(255, 255, 255, ${level})`);
  sceneCtx.globalCompositeOperation = 'source-over';
}

function restoreTour(stage: SolarStage) {
  clearSupernova(stage);
  clearBlackHole(stage);
  Object.assign(tour, createTour());
  lastLeg = 0;
  lastCuts = -1;
  shotClock = 0;
  dropping = false;
  route = undefined;
}

function rejoin(stage: SolarStage) {
  const away = clock.time - lastDrawn > REJOIN_GAP;
  lastDrawn = clock.time;
  if (!away) return;
  if (busy(cataclysm)) restoreTour(stage);
  resetCataclysm(cataclysm);
}

export function pulseSolar() {
  kick.pulse();
}

export function solarBusy() {
  return busy(cataclysm);
}

export function claimSolarDrop() {
  if (busy(cataclysm)) return true;
  const stage = solar.get();
  if (!stage || !shouldIgnite(cataclysm, tensionPeak())) {
    cataclysm.drops++;
    return false;
  }
  const { position } = stage.camera;
  ignite(cataclysm, Math.atan2(-position.z, position.x));
  return true;
}

export function solarHandoff() {
  const stage = solar.get();
  if (!stage || cataclysm.phase !== 'done') return undefined;
  restoreTour(stage);
  resetCataclysm(cataclysm);
  fx.flash = flashLevel();
  return 'Deep Space';
}

export function drawSolar() {
  const stage = solar.get();
  if (!stage) return;
  rejoin(stage);
  kick.decay();
  fitStage(stage);
  stepCataclysm(cataclysm, clock.delta, beatSeconds(BEATS_PER_BAR, UNLOCKED_BAR_SECONDS));
  const exploding = busy(cataclysm);
  if (exploding) moveCataclysmCamera(stage);
  else {
    advanceTour();
    moveCamera(stage);
  }
  animateBodies(stage);
  if (exploding) {
    animateSupernova(stage, cataclysm, kick.value);
    animateBlackHole(stage, cataclysm, kick.value);
  }
  spinAsteroids(stage);
  updateStreaks(stage);
  presentStage(stage);
  whiteOut();
}
