import { useCallback, useEffect, useRef, useState } from 'react';
import { requestPwaActivation } from './pwa-update';
import './pwa-update.css';

const withTimeout = <T,>(promise: Promise<T>, milliseconds: number): Promise<T> => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('The update check timed out. Reconnect and try again.')), milliseconds);
  promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
});

/** Checking never changes the current program or reloads an open workout. */
export function PwaUpdateControl({ onBeforeReload, activeWorkout = false, disabled = false }: {
  onBeforeReload?: () => Promise<boolean>;
  activeWorkout?: boolean;
  disabled?: boolean;
}) {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [message, setMessage] = useState('Check for a newer version without changing your saved data.');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const work = useRef(false);
  const inspect = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (mounted.current) {
        setWaiting(registration?.waiting ?? null);
        if (registration?.waiting) setMessage('A new version is ready. Updating keeps your saved data.');
      }
    } catch { /* The explicit check gives diagnostics when requested. */ }
  }, []);
  useEffect(() => {
    mounted.current = true; void inspect();
    window.addEventListener('setline:update-ready', inspect);
    return () => { mounted.current = false; window.removeEventListener('setline:update-ready', inspect); };
  }, [inspect]);

  async function check() {
    if (work.current || disabled) return;
    work.current = true; setBusy(true); setMessage('Checking…');
    try {
      if (!('serviceWorker' in navigator)) throw new Error('Close and reopen Setline while online to load the latest version.');
      if (!navigator.onLine) throw new Error('You’re offline. Reconnect, then check again.');
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (!registration) throw new Error('Offline access is still starting. Close and reopen Setline while online, then try again.');
      await withTimeout(registration.update(), 8000);
      // update() may resolve while the new worker is still downloading its cache.
      if (registration.installing) await new Promise<void>((resolve, reject) => {
        const installing = registration.installing!;
        const finish = (error?: Error) => {
          clearTimeout(timer); installing.removeEventListener('statechange', changed);
          if (error) reject(error); else resolve();
        };
        const timer = setTimeout(() => finish(new Error('The update download timed out. Reconnect and try again.')), 10000);
        const changed = () => {
          if (installing.state === 'installed' || installing.state === 'activated') finish();
          else if (installing.state === 'redundant') finish(new Error('The update could not download. Reconnect and try again.'));
        };
        installing.addEventListener('statechange', changed); changed();
      });
      if (!mounted.current) return;
      setWaiting(registration.waiting);
      setMessage(registration.waiting ? 'A new version is ready. Updating keeps your saved data.' : 'No newer version was found on this website.');
    } catch (cause) { if (mounted.current) setMessage(cause instanceof Error ? cause.message : 'Could not check for updates. Reconnect and try again.'); }
    finally { work.current = false; if (mounted.current) setBusy(false); }
  }

  async function update() {
    if (!waiting || work.current || activeWorkout || disabled) return;
    work.current = true; setBusy(true); setMessage('Saving before updating…');
    let cancelController: (() => void) | undefined;
    try {
      if (onBeforeReload && !(await onBeforeReload())) throw new Error('Your latest changes could not save. Save them before updating.');
      if (!mounted.current) return;
      const changed = new Promise<boolean>(resolve => {
        const listener = () => { cleanup(); resolve(true); };
        const timer = setTimeout(() => { cleanup(); resolve(false); }, 8000);
        const cleanup = () => { clearTimeout(timer); navigator.serviceWorker.removeEventListener('controllerchange', listener); };
        cancelController = cleanup;
        navigator.serviceWorker.addEventListener('controllerchange', listener);
      });
      const result = await requestPwaActivation(waiting);
      if (!result.accepted) { cancelController?.(); setMessage(result.reason ?? 'Close and reopen Setline to finish updating.'); return; }
      setMessage('Opening the new version…');
      if (await changed) window.location.reload();
      else setMessage('The update is ready. Close and reopen Setline to finish.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not update. Your saved data stays.'); }
    finally { cancelController?.(); work.current = false; if (mounted.current) setBusy(false); }
  }

  return <section className="pwa-update-settings" aria-labelledby="pwa-update-heading">
    <h3 id="pwa-update-heading">App updates</h3>
    <p role="status">{message}</p>
    {waiting ? <button type="button" className="btn secondary full" disabled={busy || disabled || activeWorkout} onClick={() => void update()}>{busy ? 'Updating…' : 'Update app'}</button>
      : <button type="button" className="btn secondary full" disabled={busy || disabled} onClick={() => void check()}>{busy ? 'Checking…' : 'Check for updates'}</button>}
    {waiting && activeWorkout && <p>Finish your workout before updating. It will stay open until then.</p>}
  </section>;
}
