import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/cn';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  /** Auto-dismiss in ms (default 3500). 0 = sticky. */
  duration?: number;
}

interface ToastContextValue {
  push: (msg: string, opts?: Partial<Omit<ToastItem, 'id' | 'message'>>) => void;
  success: (msg: string, opts?: Partial<Omit<ToastItem, 'id' | 'message' | 'variant'>>) => void;
  error: (msg: string, opts?: Partial<Omit<ToastItem, 'id' | 'message' | 'variant'>>) => void;
  warning: (msg: string, opts?: Partial<Omit<ToastItem, 'id' | 'message' | 'variant'>>) => void;
  info: (msg: string, opts?: Partial<Omit<ToastItem, 'id' | 'message' | 'variant'>>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantConfig: Record<ToastVariant, { icon: ReactNode; cls: string }> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    cls: 'bg-success/10 text-success border-success/20',
  },
  error: {
    icon: <XCircle className="h-5 w-5" />,
    cls: 'bg-danger/10 text-danger border-danger/20',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" />,
    cls: 'bg-warning/10 text-amber-700 border-warning/20',
  },
  info: { icon: <Info className="h-5 w-5" />, cls: 'bg-info/10 text-info border-info/20' },
};

/**
 * ToastProvider — context-based toaster.
 * Wrap the application root once and call `useToast()` from anywhere.
 */
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback<ToastContextValue['push']>(
    (message, opts) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const variant: ToastVariant = opts?.variant ?? 'info';
      const duration = opts?.duration ?? 3500;
      setItems((prev) => [...prev, { id, message, variant, duration }]);
      if (duration > 0) {
        setTimeout(() => remove(id), duration);
      }
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (m, o) => push(m, { ...o, variant: 'success' }),
      error: (m, o) => push(m, { ...o, variant: 'error' }),
      warning: (m, o) => push(m, { ...o, variant: 'warning' }),
      info: (m, o) => push(m, { ...o, variant: 'info' }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined'
        ? createPortal(
            <div className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex flex-col items-center gap-2 px-3">
              <AnimatePresence>
                {items.map((t) => {
                  const cfg = variantConfig[t.variant];
                  return (
                    <motion.div
                      key={t.id}
                      role="status"
                      initial={{ opacity: 0, y: -16, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className={cn(
                        'pointer-events-auto flex items-start gap-3 max-w-sm w-full px-4 py-3',
                        'rounded-xl border bg-surface shadow-card-hover',
                        cfg.cls,
                      )}
                    >
                      <span aria-hidden>{cfg.icon}</span>
                      <p className="flex-1 text-sm text-ink">{t.message}</p>
                      <button
                        type="button"
                        onClick={() => remove(t.id)}
                        aria-label="إغلاق"
                        className="text-gray-400 hover:text-ink"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

/** Get the toast API. Throws if used outside of <ToastProvider>. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
