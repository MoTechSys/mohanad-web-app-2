import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/cn';

/**
 * Modal — desktop-centered dialog with backdrop, ESC-to-close, and
 * focus-management via the native dialog semantics.
 *
 * Mobile users typically see <BottomSheet> instead — switch is handled
 * by the consumer at the design's 768 px breakpoint.
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Hide the (X) button — useful for confirm dialogs. */
  hideClose?: boolean;
}

const sizeClass = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
} as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  hideClose,
}: ModalProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="إغلاق"
            className="absolute inset-0 bg-ink/40 backdrop-blur-xs"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            className={cn(
              'relative z-10 w-full bg-surface rounded-2xl shadow-card-hover overflow-hidden',
              sizeClass[size],
            )}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {(title || !hideClose) && (
              <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-5">
                <div className="space-y-1">
                  {title ? <h2 className="text-base font-semibold text-ink">{title}</h2> : null}
                  {description ? <p className="text-xs text-gray-500">{description}</p> : null}
                </div>
                {!hideClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="إغلاق"
                    className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-ink"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
