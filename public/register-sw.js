// Cache the complete local app so installed workouts remain available offline.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch((error) => {
      console.warn('Setline could not enable offline access.', error);
    });
  });
}
