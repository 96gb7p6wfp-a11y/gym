import * as React from 'react';
import { RestAlertTimer, RestChime, type RestCompletion } from './rest-audio';

// App-wide service survives tab navigation and sheet mounting/unmounting.
const chime = new RestChime();
export function useRestAudio({ enabled, endsAt, volume = 0.85, onComplete }: {
  enabled: boolean;
  endsAt: number | null;
  volume?: number;
  onComplete: (result: RestCompletion) => void;
}) {
  const callback = React.useRef(onComplete); callback.current = onComplete;
  const current = React.useRef({ enabled, endsAt }); current.current = { enabled, endsAt };
  const audioState = React.useSyncExternalStore(chime.subscribe, chime.getSnapshot, chime.getSnapshot);
  const timer = React.useRef<RestAlertTimer | null>(null);
  React.useEffect(() => { chime.setVolume(volume); }, [volume]);
  React.useEffect(() => {
    const instance = new RestAlertTimer({
      now: Date.now, visible: () => document.visibilityState === 'visible',
      schedule: (fn, delay) => window.setTimeout(fn, delay), cancel: handle => window.clearTimeout(handle as number),
      play: shouldPlay => chime.play({ shouldPlay }),
      onComplete: result => {
        try { if (!result.resumed && typeof navigator.vibrate === 'function') navigator.vibrate([100, 60, 100]); }
        catch { /* Optional haptics must never prevent timer completion. */ }
        callback.current(result);
      },
    });
    timer.current = instance;
    const resume = () => {
      instance.visibilityChanged();
      const state = current.current;
      if (document.visibilityState === 'visible' && state.enabled && state.endsAt !== null && state.endsAt > Date.now()) void chime.recover();
    };
    document.addEventListener('visibilitychange', resume); window.addEventListener('pageshow', resume);
    return () => { instance.dispose(); timer.current = null; document.removeEventListener('visibilitychange', resume); window.removeEventListener('pageshow', resume); };
  }, []);
  React.useEffect(() => { timer.current?.update(endsAt, enabled); }, [endsAt, enabled]);
  const unlock = React.useCallback(() => chime.unlock(), []);
  const testSound = React.useCallback((volumeOverride?: number) => chime.play({ gesture: true, volume: volumeOverride }), []);
  return { unlock, testSound, audioState, recheckAudio: unlock };
}
