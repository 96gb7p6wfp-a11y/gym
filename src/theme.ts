import { useEffect } from 'react';

export type Appearance = 'system' | 'light' | 'dark';
type ResolvedAppearance = Exclude<Appearance, 'system'>;
const storageKey = 'setline.gym.v1';
let currentAppearance: Appearance = 'system';

export function resolveAppearance(appearance: Appearance, systemDark: boolean): ResolvedAppearance {
  return appearance === 'system' ? systemDark ? 'dark' : 'light' : appearance;
}

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyAppearance(appearance: Appearance) {
  if (typeof document === 'undefined') return;
  const resolved = resolveAppearance(appearance, systemPrefersDark());
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#141a1d' : '#f7f5f1');
}

/** Read the existing profile only. A failed/blocked read never changes user data. */
export function initializeAppearance() {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(storageKey);
    const saved = raw === null ? undefined : JSON.parse(raw)?.profile?.appearance;
    if (saved === 'light' || saved === 'dark' || saved === 'system') currentAppearance = saved;
  } catch { /* Storage recovery remains the local client's responsibility. */ }
  applyAppearance(currentAppearance);
}

/** Undefined holds the boot preference while the asynchronous profile loads. */
export function useAppearance(appearance?: Appearance) {
  useEffect(() => {
    if (appearance !== undefined) currentAppearance = appearance;
    applyAppearance(currentAppearance);
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => { if (currentAppearance === 'system') applyAppearance('system'); };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [appearance]);
}
