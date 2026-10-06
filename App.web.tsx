import { useEffect, useRef, useState } from 'react';
import { APP_URL } from './src/navigation';
import './src/web.css';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function App() {
  const [frameVersion, setFrameVersion] = useState(0);
  const [online, setOnline] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [shareMessage, setShareMessage] = useState('');
  const installDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    const updateStandalone = () => setStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && navigator.standalone === true),
    );
    const captureInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    updateOnline();
    updateStandalone();
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    window.addEventListener('beforeinstallprompt', captureInstall);
    window.addEventListener('appinstalled', updateStandalone);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      window.removeEventListener('beforeinstallprompt', captureInstall);
      window.removeEventListener('appinstalled', updateStandalone);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      installDialog.current?.showModal();
      return;
    }
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } catch {
      installDialog.current?.showModal();
    }
  }

  async function share() {
    const url = window.location.origin + '/';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Setline', url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareMessage('Link copied');
      } else {
        setShareMessage(url);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setShareMessage('Unable to share. Copy the address from your browser.');
      }
    }
  }

  return (
    <div className="setline-app">
      <header className="app-header">
        <a className="brand" href="/" aria-label="Setline home">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>Setline</span>
        </a>
        <nav aria-label="App controls" className="app-controls">
          <button type="button" onClick={() => setFrameVersion((value) => value + 1)}>Reload</button>
          <button type="button" onClick={() => void share()}>Share</button>
          {!standalone && <button className="install-button" type="button" onClick={() => void install()}>Install</button>}
        </nav>
      </header>

      <main className="gym-content">
        {online ? (
          <iframe
            key={frameVersion}
            className="gym-frame"
            src={APP_URL}
            title="Setline gym website"
            allow="fullscreen"
          />
        ) : (
          <section className="offline-state" aria-live="polite">
            <span className="offline-symbol" aria-hidden="true">↻</span>
            <h1>You're offline</h1>
            <p>Connect to the internet to load your gym.</p>
            <button className="install-button" type="button" onClick={() => {
              setOnline(navigator.onLine);
              setFrameVersion((value) => value + 1);
            }}>Try again</button>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <span>Can't see your gym?</span>
        <a href={APP_URL} target="_blank" rel="noopener noreferrer">Open website ↗</a>
        <span className="share-message" role="status">{shareMessage}</span>
      </footer>

      <dialog ref={installDialog} className="install-dialog">
        <form method="dialog">
          <button className="dialog-close" type="submit" aria-label="Close install instructions">×</button>
          <span className="dialog-icon" aria-hidden="true">S</span>
          <h2>Add Setline to your iPhone</h2>
          <p>Open this page in Safari. Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>, and tap <strong>Add</strong>.</p>
          <p className="dialog-note">You can open Setline from its home-screen icon. Internet is needed to load your gym.</p>
          <button className="install-button" type="submit">Got it</button>
        </form>
      </dialog>
    </div>
  );
}
