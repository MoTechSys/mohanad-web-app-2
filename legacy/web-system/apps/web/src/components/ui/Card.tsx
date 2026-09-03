import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';

import { cn } from '@/lib/cn';

/**
 * Card — content container with optional header/footer slots and hover lift.
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  footer?: ReactNode;
  /** Apply hover-lift shadow + slight scale animation. */
  interactive?: boolean;
  /** Frosted-glass body (used on the Login card). */
  glass?: boolean;
  /** Removes default padding so children control their own layout. */
  flush?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, header, footer, interactive, glass, flush, children, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        'card overflow-hidden',
        glass && 'glass border-white/60',
        interactive && 'card-hover hover:-translate-y-[1px] transition-transform duration-base',
        className,
      )}
      {...rest}
    >
      {header ? (
        <div className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-ink">
          {header}
        </div>
      ) : null}
      <div className={cn(!flush && 'p-5')}>{children}</div>
      {footer ? (
        <div className="border-t border-gray-100 bg-surface-alt px-5 py-3 text-sm">{footer}</div>
      ) : null}
    </div>
  ),
);

Card.displayName = 'Card';
