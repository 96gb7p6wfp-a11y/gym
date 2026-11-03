/** A reload restores this tab's timer without sharing it with another app tab. */
export const REST_DEADLINE_KEY = 'setline.rest-deadline.v1';
const MAX_REST_AGE = 24 * 60 * 60 * 1000;
type TimerStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readRestDeadline(storage: TimerStorage, now = Date.now()): number | null {
  try {
    const raw = storage.getItem(REST_DEADLINE_KEY);
    if (raw === null) return null;
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== 'number' || !Number.isSafeInteger(saved) || Math.abs(saved - now) > MAX_REST_AGE) {
      storage.removeItem(REST_DEADLINE_KEY); return null;
    }
    // Keep a recently expired deadline so the UI can explain silent recovery.
    return saved;
  } catch { return null; }
}

/** Storage restrictions must never stop the running in-memory rest timer. */
export function saveRestDeadline(storage: TimerStorage, deadline: number | null): void {
  try {
    if (deadline === null) storage.removeItem(REST_DEADLINE_KEY);
    else storage.setItem(REST_DEADLINE_KEY, JSON.stringify(deadline));
  } catch { /* The live timer still works when session storage is unavailable. */ }
}
