import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { t } from '@/i18n/ar';
import { cn } from '@/lib/cn';

/**
 * Sidebar — desktop (≥768 px) primary navigation.
 *
 * Visible only on `desktop:` breakpoint; mobile uses <BottomNav>.
 * Items are passed in from the AppShell so feature flags / RBAC
 * can shape the list per user.
 */
export interface SidebarItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission?: string | string[];
}

export interface SidebarProps {
  items?: SidebarItem[];
  onLogout?: () => void;
  className?: string;
}

const defaultItems: SidebarItem[] = [
  { to: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { to: '/customers', label: 'العملاء', icon: Users },
  { to: '/sales', label: 'المبيعات', icon: Receipt },
  { to: '/suppliers', label: 'الموردون', icon: Truck },
  { to: '/purchases', label: 'المشتريات', icon: ShoppingCart },
  { to: '/expenses', label: 'المصاريف', icon: Wallet },
  { to: '/reports', label: 'التقارير', icon: BarChart3 },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
];

export function Sidebar({ items = defaultItems, onLogout, className }: SidebarProps): JSX.Element {
  const { pathname } = useLocation();
  return (
    <aside
      aria-label="التنقل الجانبي"
      className={cn(
        'hidden desktop:flex flex-col w-64 shrink-0 border-l border-gray-200 bg-surface/85 backdrop-blur',
        'sticky top-0 h-screen',
        className,
      )}
    >
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-emerald text-primary-800 font-bold shadow-glow">
          ب
        </div>
        <div className="flex-1 leading-tight">
          <p className="text-sm font-semibold text-ink">{t('app.name')}</p>
          <p className="text-xs text-gray-500">{t('app.tagline')}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-ink',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-100 p-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
