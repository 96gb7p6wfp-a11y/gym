// The shell can reopen offline; the embedded gym website still needs a connection.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch((error) => {
      console.warn('Setline could not enable its offline app shell.', error);
    });
  });
}
