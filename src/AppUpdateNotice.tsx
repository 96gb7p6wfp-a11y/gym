import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import './pwa-update.css';

/** Visible discovery only; safe activation continues through the existing Settings flow. */
export function AppUpdateNotice({ onOpenSettings, activeWorkout }: { onOpenSettings:()=>void; activeWorkout:boolean }) {
  const [ready,setReady] = useState(false);
  useEffect(()=>{
    let mounted = true;
    async function inspect() {
      if (!('serviceWorker' in navigator)) return;
      try { const registration = await navigator.serviceWorker.getRegistration('/'); if(mounted) setReady(!!registration?.waiting); } catch { /* Offline workouts remain available. */ }
    }
    void inspect(); window.addEventListener('setline:update-ready',inspect);
    navigator.serviceWorker?.addEventListener('controllerchange',inspect);
    return ()=>{mounted=false;window.removeEventListener('setline:update-ready',inspect);navigator.serviceWorker?.removeEventListener('controllerchange',inspect);};
  },[]);
  if(!ready) return null;
  return <button type="button" className="app-update-notice" onClick={onOpenSettings} aria-label="Review available app update"><RefreshCw size={18} aria-hidden="true"/><span><strong>App update ready</strong><small>{activeWorkout?'Finish your workout before updating.':'Review in Settings. Your saved records stay.'}</small></span></button>;
}
