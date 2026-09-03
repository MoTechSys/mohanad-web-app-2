import { type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Badge — small status chip used for state indicators (debt/credit/active/…).
 */
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'credit' | 'debt';
  icon?: ReactNode;
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  credit: 'bg-blue-100 text-blue-700',
  debt: 'bg-red-100 text-red-700',
};

export function Badge({
  className,
  variant = 'neutral',
  icon,
  children,
  ...rest
}: BadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {icon ? (
        <span aria-hidden className="-ms-0.5">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
