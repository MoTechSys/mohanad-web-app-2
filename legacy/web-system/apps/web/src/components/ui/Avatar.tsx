import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * Avatar — circular badge displaying initials (no images in v1).
 *
 * Falls back to a single grayscale glyph when `name` is empty.
 */
export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Force a specific background hue. Defaults to deterministic per name. */
  tone?: 'primary' | 'info' | 'warning' | 'danger';
}

const sizeMap = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
} as const;

const toneMap = {
  primary: 'bg-primary-100 text-primary-700',
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
} as const;

function deriveInitials(name?: string): string {
  if (!name) return '؟';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({
  name,
  size = 'md',
  tone = 'primary',
  className,
  ...rest
}: AvatarProps): JSX.Element {
  return (
    <div
      role="img"
      aria-label={name ?? 'مستخدم'}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold select-none',
        sizeMap[size],
        toneMap[tone],
        className,
      )}
      {...rest}
    >
      {deriveInitials(name)}
    </div>
  );
}
