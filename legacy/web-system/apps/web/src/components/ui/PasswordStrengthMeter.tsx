import { motion } from 'framer-motion';
import { type HTMLAttributes, useMemo } from 'react';

import { cn } from '@/lib/cn';

/**
 * PasswordStrengthMeter — Phase 2 P2-6.
 *
 * Lightweight (no zxcvbn) heuristic strength indicator for password fields.
 * The score is computed as the count of satisfied rules (length / case /
 * digit / special) clamped to 1..5 levels:
 *
 *   1 very-weak   red       "كلمة المرور ضعيفة جداً"
 *   2 weak        orange    "أضف أحرف كبيرة وصغيرة"
 *   3 fair        yellow    "أضف أرقام أو رموز خاصة"
 *   4 good        blue      "كلمة مرور جيدة"
 *   5 strong      emerald   "كلمة مرور قوية ✓"
 *
 * Empty input → meter is hidden (5 muted segments, neutral hint).
 *
 * Used by:
 *   • Create User modal
 *   • Reset Password modal
 *   • Account → Change Password
 */
export interface PasswordStrengthMeterProps extends HTMLAttributes<HTMLDivElement> {
  password: string;
  /** Minimum acceptable length (defaults to 8 to match the API). */
  minLength?: number;
}

export interface StrengthResult {
  /** 0 (empty) or 1..5 levels. */
  level: number;
  /** Arabic short label for the meter caption. */
  labelAr: string;
  /** Tailwind classes for fill color & caption color. */
  fillClass: string;
  textClass: string;
  /** Concrete checks — exposed for tests / a11y. */
  checks: {
    length: boolean;
    upper: boolean;
    lower: boolean;
    digit: boolean;
    special: boolean;
  };
}

const SPECIAL = /[^A-Za-z0-9]/;
const UPPER = /[A-Z]/;
const LOWER = /[a-z]/;
const DIGIT = /\d/;

export function scorePassword(password: string, minLength = 8): StrengthResult {
  const checks = {
    length: password.length >= minLength,
    upper: UPPER.test(password),
    lower: LOWER.test(password),
    digit: DIGIT.test(password),
    special: SPECIAL.test(password),
  };

  if (!password) {
    return {
      level: 0,
      labelAr: '',
      fillClass: 'bg-gray-200',
      textClass: 'text-gray-500',
      checks,
    };
  }

  // Each rule contributes 1 point; cap to 5.
  const points =
    (checks.length ? 1 : 0) +
    (checks.upper ? 1 : 0) +
    (checks.lower ? 1 : 0) +
    (checks.digit ? 1 : 0) +
    (checks.special ? 1 : 0);

  // Soft penalty: if length<min, never go above level 2 even if other rules pass.
  const level = checks.length ? points : Math.min(points, 2);

  switch (level) {
    case 5:
      return {
        level,
        labelAr: 'كلمة مرور قوية ✓',
        fillClass: 'bg-emerald-600',
        textClass: 'text-emerald-700',
        checks,
      };
    case 4:
      return {
        level,
        labelAr: 'كلمة مرور جيدة',
        fillClass: 'bg-blue-500',
        textClass: 'text-blue-700',
        checks,
      };
    case 3:
      return {
        level,
        labelAr: 'أضف أرقام أو رموز خاصة',
        fillClass: 'bg-yellow-500',
        textClass: 'text-yellow-700',
        checks,
      };
    case 2:
      return {
        level,
        labelAr: 'أضف أحرف كبيرة وصغيرة',
        fillClass: 'bg-orange-500',
        textClass: 'text-orange-700',
        checks,
      };
    default:
      return {
        level: 1,
        labelAr: 'كلمة المرور ضعيفة جداً',
        fillClass: 'bg-red-500',
        textClass: 'text-red-600',
        checks,
      };
  }
}

export function PasswordStrengthMeter({
  password,
  minLength = 8,
  className,
  ...rest
}: PasswordStrengthMeterProps): JSX.Element {
  const result = useMemo(() => scorePassword(password, minLength), [password, minLength]);

  return (
    <div
      className={cn('flex flex-col gap-1.5', className)}
      role="status"
      aria-live="polite"
      {...rest}
    >
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4, 5].map((seg) => {
          const filled = result.level >= seg;
          return (
            <motion.div
              key={seg}
              initial={false}
              animate={{ scaleX: filled ? 1 : 0.6, opacity: filled ? 1 : 0.35 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={cn(
                'h-1.5 flex-1 origin-end rounded-full transition-colors duration-200',
                filled ? result.fillClass : 'bg-gray-200',
              )}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className={cn('font-medium', result.textClass)}>
          {result.level === 0 ? 'أدخل كلمة المرور' : result.labelAr}
        </span>
        {password ? (
          <span className="text-gray-400 font-mono tabular-nums">
            {password.length}/{minLength}+
          </span>
        ) : null}
      </div>
    </div>
  );
}
