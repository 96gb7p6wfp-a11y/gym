import * as React from 'react';
import { RestAlertTimer, RestChime, type RestCompletion } from './rest-audio';

const chime = new RestChime();

export function useRestAudio({ enabled, endsAt, onComplete }: {
  enabled: boolean;
  endsAt: number | null;
  onComplete: (result: RestCompletion) => void;
}) {
  const callback = React.useRef(onComplete);
  callback.current = onComplete;
  const timer = React.useRef<RestAlertTimer | null>(null);
  React.useEffect(() => {
    const instance = new RestAlertTimer({
      now: Date.now,
      visible: () => document.visibilityState === 'visible',
      schedule: (fn, delay) => window.setTimeout(fn, delay),
      cancel: handle => window.clearTimeout(handle as number),
      play: () => chime.play(),
      onComplete: result => {
        try { if (!result.resumed && typeof navigator.vibrate === 'function') navigator.vibrate([100, 60, 100]); }
        catch { /* Optional haptics must never prevent the timer from completing. */ }
        callback.current(result);
      },
    });
    timer.current = instance;
    const resume = () => instance.visibilityChanged();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pageshow', resume);
    return () => {
      instance.dispose(); timer.current = null;
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pageshow', resume);
    };
  }, []);
  React.useEffect(() => { timer.current?.update(endsAt, enabled); }, [endsAt, enabled]);
  const unlock = React.useCallback(() => chime.unlock(), []);
  const testSound = React.useCallback(async () => (await chime.unlock()) && chime.play(), []);
  return { unlock, testSound };
}
