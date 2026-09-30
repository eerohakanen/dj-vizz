import { settings } from './state';

export const REDUCED_MOTION_SCALE = 0.3;

const QUERY = '(prefers-reduced-motion: reduce)';

export const comfort = {
  reduced: false,
  strobeOptIn: false,
};

export const motionScale = () => (comfort.reduced ? REDUCED_MOTION_SCALE : 1);

export const flashLevel = () => settings.flashes * motionScale();

export const shakeLevel = () => settings.punch * motionScale();

export const strobeActive = () => settings.strobe && (!comfort.reduced || comfort.strobeOptIn);

export const effectEnabled = (key: 'trails' | 'lasers' | 'glitch' | 'strobe') =>
  key === 'strobe' ? strobeActive() : settings[key];

export function allowStrobe() {
  comfort.strobeOptIn = true;
}

export function revokeStrobe() {
  comfort.strobeOptIn = false;
}

export function bindReducedMotion() {
  if (typeof matchMedia !== 'function') return;
  const query = matchMedia(QUERY);
  comfort.reduced = query.matches;
  query.addEventListener('change', (event) => {
    comfort.reduced = event.matches;
    if (!event.matches) comfort.strobeOptIn = false;
  });
}
