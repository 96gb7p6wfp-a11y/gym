import * as React from 'react';
import { readRestDeadline, saveRestDeadline } from './rest-deadline';

export function useRestDeadline(): [number | null, (deadline: number | null) => void] {
  const [deadline, update] = React.useState<number | null>(() => {
    try { return readRestDeadline(window.sessionStorage); } catch { return null; }
  });
  const setDeadline = React.useCallback((next: number | null) => {
    // Save synchronously with the tap: a refresh immediately afterwards should
    // not lose the adjustment while waiting for a React effect to run.
    try { saveRestDeadline(window.sessionStorage, next); } catch { /* Restricted storage. */ }
    update(next);
  }, []);
  return [deadline, setDeadline];
}
