import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  type LucideIcon,
  MoreHorizontal,
  Receipt,
  Users,
  Wallet,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { cn } from '@/lib/cn';

/**
 * BottomNav — mobile bottom-tab navigation (5 dynamic slots).
 *
 * The set of tabs is supplied by the caller so role-based combinations
 * (sales worker, accountant, owner, …) can be plugged in during Phase 2.
 * Foundation provides a sensible default that mirrors the Owner role.
 */
export interface BottomNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Permission code(s) required — checked by Phase 2 RBAC; ignored now. */
  permission?: string | string[];
}

export interface BottomNavProps {
  items?: BottomNavItem[];
  className?: string;
}

const defaultItems: BottomNavItem[] = [
  { to: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { to: '/customers', label: 'العملاء', icon: Users },
  { to: '/sales', label: 'المبيعات', icon: Receipt },
  { to: '/expenses', label: 'المصاريف', icon: Wallet },
  { to: '/more', label: 'المزيد', icon: MoreHorizontal },
];

export function BottomNav({ items = defaultItems, className }: BottomNavProps): JSX.Element {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="التنقل السفلي"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 desktop:hidden',
        'border-t border-gray-200 bg-surface/95 backdrop-blur',
        'h-16 px-2',
        className,
      )}
    >
      <ul className="grid h-full grid-cols-5 items-stretch">
        {items.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <li key={item.to} className="flex">
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex w-full flex-col items-center justify-center gap-1',
                  'text-xs font-medium transition-colors duration-fast',
                  active ? 'text-primary-700' : 'text-gray-500 hover:text-ink',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>{item.label}</span>
                {active ? (
                  <motion.span
                    layoutId="bottom-nav-pill"
                    className="absolute inset-x-3 -top-px h-0.5 rounded-full bg-primary-600"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
