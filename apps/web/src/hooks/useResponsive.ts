import { useEffect, useState } from 'react';

/**
 * useMediaQuery — subscribe to a CSS media query.
 *
 * Returns the current match state and updates on viewport changes.
 * SSR-safe (returns `false` until hydration).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * useIsDesktop — `true` for viewports ≥ 768 px (matches the `desktop:`
 * Tailwind breakpoint and the Modal-vs-BottomSheet decision boundary).
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)');
}
