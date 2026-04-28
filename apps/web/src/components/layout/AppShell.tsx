import { type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';
import { BottomNav } from './BottomNav';
import { MobileTopBar } from './MobileTopBar';
import { Sidebar } from './Sidebar';

/**
 * AppShell — the responsive chrome wrapping authenticated pages.
 *
 *   • Mobile (< 768 px): sticky top bar + bottom tab navigation
 *   • Desktop (≥ 768 px): persistent sidebar on the right (RTL),
 *                          main content scrolls independently.
 */
export interface AppShellProps {
  title: ReactNode;
  withBack?: boolean;
  onBack?: () => void;
  children: ReactNode;
  className?: string;
}

export function AppShell({
  title,
  withBack,
  onBack,
  children,
  className,
}: AppShellProps): JSX.Element {
  const { user, clearSession } = useAuthStore();

  return (
    <div className={cn('min-h-screen flex bg-surface-alt', className)}>
      <Sidebar onLogout={clearSession} />

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="desktop:hidden">
          <MobileTopBar
            title={title}
            withBack={withBack}
            onBack={onBack}
            user={user ? { name: user.fullName } : undefined}
          />
        </div>

        <main className="flex-1 px-4 desktop:px-8 pt-4 desktop:pt-6 pb-24 desktop:pb-10 max-w-screen-2xl w-full mx-auto">
          {children}
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
