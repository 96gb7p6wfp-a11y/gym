// Cache the complete local app so installed workouts remain available offline.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    let registration;
    let checking = false;
    let lastChecked = 0;
    const announce = () => {
      if (registration?.waiting) window.dispatchEvent(new Event('setline:update-ready'));
    };
    const check = async () => {
      if (!registration || checking || document.visibilityState !== 'visible' || !navigator.onLine || Date.now() - lastChecked < 60_000) return;
      checking = true; lastChecked = Date.now();
      try { await registration.update(); announce(); }
      catch { /* A foreground check must never interrupt offline workouts. */ }
      finally { checking = false; }
    };
    navigator.serviceWorker.register('/service-worker.js', { scope: '/', updateViaCache: 'none' }).then((saved) => {
      registration = saved; announce();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => { if (worker.state === 'installed') announce(); });
      });
      // Updates download quietly. Activation and reload always require an
      // explicit user action, so a foreground workout stays in place.
      document.addEventListener('visibilitychange', () => { void check(); });
      window.addEventListener('pageshow', () => { void check(); });
    }).catch((error) => { console.warn('Setline could not enable offline access.', error); });
  });
}
