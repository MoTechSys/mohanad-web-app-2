import { motion } from 'framer-motion';
import { Inbox, type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * EmptyState — friendly placeholder shown when a list/page has no data.
 * Pairs an illustration (icon), title, helper text, and an optional CTA.
 */
export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-10 text-center',
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
        <Icon className="h-7 w-7" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {description ? <p className="text-sm text-gray-500">{description}</p> : null}
      </div>
      {action}
    </motion.div>
  );
}
