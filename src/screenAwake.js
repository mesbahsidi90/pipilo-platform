// Keeps the screen on while a page needs to be seen or heard (a waiting
// customer, a waiting-room TV). Returns a function that lets the screen sleep.
export function keepScreenAwake(env = globalThis) {
  const doc = env.document;
  let lock = null,
    stopped = false;
  const request = async () => {
    if (stopped || doc?.visibilityState !== 'visible' || !env.navigator?.wakeLock) return;
    try {
      lock = await env.navigator.wakeLock.request('screen');
      if (stopped) lock.release?.().catch?.(() => {});
    } catch {
      // Low battery mode or an old browser: the screen follows the phone's settings.
    }
  };
  void request();
  doc?.addEventListener('visibilitychange', request);
  return () => {
    stopped = true;
    doc?.removeEventListener('visibilitychange', request);
    lock?.release?.().catch?.(() => {});
    lock = null;
  };
}

// iPhone or iPad Safari outside a home-screen app: no lock-screen push, so the
// open page itself has to ring.
export function iosBrowser(env = globalThis) {
  const nav = env.navigator || {};
  const ios =
    /iPad|iPhone|iPod/.test(nav.userAgent || '') ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const standalone =
    nav.standalone === true || Boolean(env.matchMedia?.('(display-mode: standalone)').matches);
  return ios && !standalone;
}
