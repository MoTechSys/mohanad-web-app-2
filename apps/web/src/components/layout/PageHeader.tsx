import { type ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * PageHeader — large in-page title block placed above the main grid.
 * Optional eyebrow, description, and trailing action slot.
 */
export interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps): JSX.Element {
  return (
    <div
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-xs uppercase tracking-wider text-primary-700/80">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl desktop:text-3xl font-bold text-ink text-balance">{title}</h1>
        {description ? <p className="text-sm text-gray-500 max-w-prose">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
