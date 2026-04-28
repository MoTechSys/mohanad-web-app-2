import { ChevronRight, Menu, Search } from 'lucide-react';
import { type ReactNode } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';

/**
 * MobileTopBar — slim header used on screens below the desktop breakpoint.
 *
 * Layout (RTL): [back / menu]  [title]  [user avatar / actions]
 */
export interface MobileTopBarProps {
  title: ReactNode;
  /** Show a "back" chevron instead of the burger button. */
  withBack?: boolean;
  onBack?: () => void;
  onMenu?: () => void;
  /** Slot for action icons placed in front of the avatar. */
  actions?: ReactNode;
  user?: { name: string };
  className?: string;
}

export function MobileTopBar({
  title,
  withBack,
  onBack,
  onMenu,
  actions,
  user,
  className,
}: MobileTopBarProps): JSX.Element {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200/80',
        'bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/70',
        'px-4 h-14',
        className,
      )}
    >
      <button
        type="button"
        onClick={withBack ? onBack : onMenu}
        aria-label={withBack ? 'رجوع' : 'القائمة'}
        className="rounded-md p-2 text-ink hover:bg-gray-100"
      >
        {withBack ? <ChevronRight className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <h1 className="flex-1 truncate text-base font-semibold text-ink">{title}</h1>

      <div className="flex items-center gap-1">
        {actions ?? (
          <button
            type="button"
            aria-label="بحث"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-ink"
          >
            <Search className="h-5 w-5" />
          </button>
        )}
        <Avatar size="sm" name={user?.name} />
      </div>
    </header>
  );
}
