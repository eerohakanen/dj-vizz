let sentinel: WakeLockSentinel | null = null;
let wanted = false;

async function acquire() {
  if (!wanted || sentinel || document.visibilityState !== 'visible' || !navigator.wakeLock) return;
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
  } catch {}
}

const reacquire = () => {
  acquire();
};

export function holdWakeLock() {
  wanted = true;
  document.addEventListener('visibilitychange', reacquire);
  acquire();
  return releaseWakeLock;
}

function releaseWakeLock() {
  wanted = false;
  document.removeEventListener('visibilitychange', reacquire);
  sentinel?.release().catch(() => {});
  sentinel = null;
}
