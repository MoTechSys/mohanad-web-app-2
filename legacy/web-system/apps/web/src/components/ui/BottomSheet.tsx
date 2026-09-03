import { AnimatePresence, motion } from 'framer-motion';
import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/cn';

/**
 * BottomSheet — mobile-friendly modal that slides up from the bottom.
 * Pair with <Modal> on desktop (≥ 768 px) per docs/05-ui-ux-guidelines.md.
 */
export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Allow dismiss by tapping the backdrop (default true). */
  dismissOnBackdrop?: boolean;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  dismissOnBackdrop = true,
}: BottomSheetProps): JSX.Element | null {
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
          className="fixed inset-0 z-[100]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            type="button"
            aria-label="إغلاق"
            className="absolute inset-0 bg-ink/40 backdrop-blur-xs"
            onClick={() => dismissOnBackdrop && onClose()}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              'absolute bottom-0 inset-x-0 bg-surface rounded-t-3xl shadow-sheet',
              'max-h-[85vh] overflow-y-auto',
            )}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            <div className="flex justify-center pt-3">
              <span className="h-1.5 w-12 rounded-full bg-gray-300" aria-hidden />
            </div>
            {title ? (
              <h2 className="px-5 pt-3 pb-2 text-base font-semibold text-ink">{title}</h2>
            ) : null}
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
