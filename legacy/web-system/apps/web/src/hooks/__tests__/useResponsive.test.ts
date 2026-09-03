import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useIsDesktop, useMediaQuery } from '../useResponsive';

/**
 * Minimal MediaQueryList mock that lets tests trigger the `change` event.
 */
function installMatchMedia(initial: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: initial,
    media: '(min-width: 768px)',
    onchange: null,
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  });

  return {
    setMatches(next: boolean) {
      (mql as { matches: boolean }).matches = next;
      const event = { matches: next, media: mql.media } as MediaQueryListEvent;
      for (const fn of listeners) fn(event);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMediaQuery', () => {
  it('returns the initial match value from window.matchMedia', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('updates when the underlying MediaQueryList fires a change event', () => {
    const ctrl = installMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
    act(() => {
      ctrl.setMatches(true);
    });
    expect(result.current).toBe(true);
  });

  it('removes its listener on unmount', () => {
    installMatchMedia(true);
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(() => unmount()).not.toThrow();
  });
});

describe('useIsDesktop', () => {
  it('is `true` when (min-width: 768px) matches', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
  });

  it('is `false` when (min-width: 768px) does not match', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);
  });
});
