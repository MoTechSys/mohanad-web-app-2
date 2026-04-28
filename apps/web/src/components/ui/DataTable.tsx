import { type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

/**
 * DataTable — minimal RTL-friendly table primitive.
 *
 *   • Generic over row shape `T`.
 *   • Columns provide an Arabic header and a render function.
 *   • Built-in loading (Skeleton) and empty (EmptyState) modes.
 *   • Mobile fallback: horizontal scroll. The full responsive
 *     "row → card" transformation lands in Phase 2.
 */
export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Cell renderer. Return any ReactNode (string, number, JSX). */
  render: (row: T, index: number) => ReactNode;
  /** Optional Tailwind class applied to <td>. */
  cellClass?: string;
  /** When true, content is right-aligned (use for numbers). */
  numeric?: boolean;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  /** Stable id extractor — defaults to `index`. */
  rowKey?: (row: T, index: number) => string | number;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey = (_, i) => i,
  isLoading,
  emptyTitle = 'لا توجد بيانات',
  emptyDescription,
  className,
}: DataTableProps<T>): JSX.Element {
  if (isLoading) {
    return (
      <div className={cn('rounded-xl border border-gray-200 bg-surface p-4 space-y-3', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={cn('rounded-xl border border-gray-200 bg-surface', className)}>
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto rounded-xl border border-gray-200 bg-surface', className)}>
      <table className="w-full text-sm">
        <thead className="bg-surface-alt text-xs uppercase tracking-wide text-gray-500">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn('px-4 py-3 font-semibold', c.numeric ? 'text-end' : 'text-start')}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, idx) => (
            <tr key={rowKey(row, idx)} className="hover:bg-primary-50/40 transition-colors">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-4 py-3 text-ink',
                    c.numeric ? 'text-end font-mono' : 'text-start',
                    c.cellClass,
                  )}
                >
                  {c.render(row, idx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
