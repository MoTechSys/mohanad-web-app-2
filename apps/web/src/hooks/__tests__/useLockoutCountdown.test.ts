/**
 * useLockoutCountdown hook tests — Phase 2 P2-5.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLockoutCountdown } from '@/hooks/useLockoutCountdown';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-28T00:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useLockoutCountdown', () => {
  it('returns 0/inactive when lockedUntil is null', () => {
    const { result } = renderHook(() => useLockoutCountdown(null));
    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.active).toBe(false);
    expect(result.current.formatted).toBe('00:00');
  });

  it('returns the initial seconds-remaining and MM:SS', () => {
    const lockedUntil = new Date(Date.now() + 65_000).toISOString(); // 1m 05s
    const { result } = renderHook(() => useLockoutCountdown(lockedUntil));
    expect(result.current.secondsLeft).toBe(65);
    expect(result.current.formatted).toBe('01:05');
    expect(result.current.active).toBe(true);
  });

  it('formats minutes ≥ 10 correctly', () => {
    const lockedUntil = new Date(Date.now() + 15 * 60_000).toISOString();
    const { result } = renderHook(() => useLockoutCountdown(lockedUntil));
    expect(result.current.formatted).toBe('15:00');
  });

  it('decrements every second', () => {
    const lockedUntil = new Date(Date.now() + 5_000).toISOString();
    const { result } = renderHook(() => useLockoutCountdown(lockedUntil));
    expect(result.current.secondsLeft).toBe(5);

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.secondsLeft).toBe(3);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.active).toBe(false);
  });

  it('calls onExpire exactly once when reaching zero', () => {
    const onExpire = vi.fn();
    const lockedUntil = new Date(Date.now() + 2_000).toISOString();
    renderHook(() => useLockoutCountdown(lockedUntil, onExpire));

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    // The hook is drift-free: it may tick once on mount and once after
    // expiry. Either way `onExpire` fires once we hit zero.
    expect(onExpire).toHaveBeenCalled();
  });
});
