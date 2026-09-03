import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * Skeleton — animated shimmer placeholder.
 *
 * Use for list rows, cards, dashboard tiles before the data arrives.
 * Inherits height from props or className; falls back to `h-4`.
 */
export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Convenience helper for a circular avatar skeleton. */
  rounded?: boolean;
}

export function Skeleton({ className, rounded, ...rest }: SkeletonProps): JSX.Element {
  return (
    <div
      role="status"
      aria-label="جاري التحميل"
      className={cn('skeleton h-4 w-full', rounded && 'rounded-full aspect-square', className)}
      {...rest}
    />
  );
}
