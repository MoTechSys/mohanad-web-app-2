import { useEffect, useState } from 'react';

/**
 * useLockoutCountdown — Phase 2 P2-5.
 *
 * Returns the seconds remaining until `lockedUntil` (ISO date) reaches now,
 * along with a pre-formatted MM:SS string for the UI.  Self-clears (returns
 * `null`) once the countdown reaches zero and calls the optional `onExpire`
 * callback exactly once.
 *
 * Implementation notes:
 *   • Drift-free: every tick recomputes against `Date.now()` rather than
 *     decrementing a counter.
 *   • Updates exactly once per second (1 000 ms interval) to keep the UI
 *     paint cost minimal.
 */
export interface LockoutCountdown {
  /** Whole seconds remaining (≥ 0). 0 means expired. */
  secondsLeft: number;
  /** Pre-formatted "MM:SS". */
  formatted: string;
  /** True while > 0. */
  active: boolean;
}

function format(secs: number): string {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function useLockoutCountdown(
  lockedUntil: string | null | undefined,
  onExpire?: () => void,
): LockoutCountdown {
  const targetMs = lockedUntil ? new Date(lockedUntil).getTime() : 0;
  const [secondsLeft, setSecondsLeft] = useState(() =>
    targetMs ? Math.max(0, Math.ceil((targetMs - Date.now()) / 1000)) : 0,
  );

  useEffect(() => {
    if (!targetMs) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((targetMs - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) onExpire?.();
    };
    tick(); // initialise immediately
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs, onExpire]);

  return {
    secondsLeft,
    formatted: format(secondsLeft),
    active: secondsLeft > 0,
  };
}
