import { ChevronLeft } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/cn';

/**
 * Breadcrumbs — small RTL trail above admin pages.
 *
 *   <Breadcrumbs items={[
 *     { label: 'الإدارة', to: '/admin/users' },
 *     { label: 'المستخدمون' },
 *   ]} />
 *
 * Last item is rendered as plain text (current page).
 */
export interface BreadcrumbItem {
  label: ReactNode;
  to?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps): JSX.Element {
  return (
    <nav
      aria-label="مسار التصفح"
      className={cn('flex items-center text-xs text-gray-500', className)}
    >
      {items.map((item, idx) => {
        const last = idx === items.length - 1;
        return (
          <Fragment key={`${idx}-${typeof item.label === 'string' ? item.label : 'crumb'}`}>
            {item.to && !last ? (
              <Link
                to={item.to}
                className="rounded-md px-1.5 py-0.5 hover:bg-gray-100 hover:text-ink transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn('px-1.5 py-0.5', last && 'text-ink font-medium')}>
                {item.label}
              </span>
            )}
            {!last ? (
              <ChevronLeft className="h-3.5 w-3.5 mx-0.5 text-gray-300" aria-hidden />
            ) : null}
          </Fragment>
        );
      })}
    </nav>
  );
}
