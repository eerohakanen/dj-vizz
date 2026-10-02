import { settings } from './state';

export const REDUCED_MOTION_SCALE = 0.3;

const QUERY = '(prefers-reduced-motion: reduce)';

export const comfort = {
  reduced: false,
};

export const motionScale = () => (comfort.reduced ? REDUCED_MOTION_SCALE : 1);

export const shakeLevel = () => settings.punch * motionScale();

export function bindReducedMotion() {
  if (typeof matchMedia !== 'function') return;
  const query = matchMedia(QUERY);
  comfort.reduced = query.matches;
  query.addEventListener('change', (event) => {
    comfort.reduced = event.matches;
  });
}
