import { motion } from 'framer-motion';
import { type ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * PageTransition — wraps a page's main content in a subtle fade + lift
 * animation so route changes feel polished without overpowering Ionic's
 * native router transitions.
 */
export interface PageTransitionProps {
  children: ReactNode;
  className?: string;
  /** Delay (ms) before the animation begins. */
  delay?: number;
}

export function PageTransition({
  children,
  className,
  delay = 0,
}: PageTransitionProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1], delay: delay / 1000 }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
