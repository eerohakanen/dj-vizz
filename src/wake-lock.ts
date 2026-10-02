import { desktop } from './desktop';

let sentinel: WakeLockSentinel | null = null;
let requesting = false;
let wanted = false;

async function acquire() {
  if (!wanted || sentinel || requesting || document.visibilityState !== 'visible' || !navigator.wakeLock) return;
  requesting = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (!wanted) {
      lock.release().catch(() => {});
      return;
    }
    sentinel = lock;
    lock.addEventListener('release', () => {
      if (sentinel === lock) sentinel = null;
    });
  } catch {
  } finally {
    requesting = false;
  }
}

const reacquire = () => {
  acquire();
};

export function holdWakeLock() {
  wanted = true;
  desktop?.holdAwake(true);
  document.addEventListener('visibilitychange', reacquire);
  acquire();
  return releaseWakeLock;
}

function releaseWakeLock() {
  wanted = false;
  desktop?.holdAwake(false);
  document.removeEventListener('visibilitychange', reacquire);
  sentinel?.release().catch(() => {});
  sentinel = null;
}
