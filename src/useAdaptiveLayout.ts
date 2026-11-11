import { useCallback, useSyncExternalStore } from 'react';

/** Window width, not user-agent identity. Changes never recreate training state. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((callback: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener('change', callback);
    return () => media.removeEventListener('change', callback);
  }, [query]);
  const snapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

export function useWideLayout(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
