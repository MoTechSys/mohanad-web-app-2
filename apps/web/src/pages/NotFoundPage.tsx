import { motion } from 'framer-motion';
import { ArrowLeft, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { t } from '@/i18n/ar';

/**
 * NotFoundPage — animated 404 (Q7: SVG + framer-motion, no Lottie).
 */
export function NotFoundPage(): JSX.Element {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-emerald grid place-items-center p-4">
      <motion.div
        aria-hidden
        className="absolute -top-40 -end-32 h-96 w-96 rounded-full bg-primary-300/30 blur-3xl"
        animate={{ y: [0, 12, 0] }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 9, ease: 'easeInOut' }}
      />

      <div className="relative z-10 max-w-lg text-center">
        {/* Animated 404 SVG */}
        <motion.svg
          viewBox="0 0 200 100"
          className="mx-auto h-40 w-72 text-primary-700"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          role="img"
          aria-label="404"
        >
          {/* digit 4 */}
          <motion.path
            d="M30 75 L30 35 L55 35 L55 75 M55 60 L20 60"
            fill="none"
            stroke="currentColor"
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
          {/* digit 0 (animated pulse) */}
          <motion.circle
            cx={100}
            cy={55}
            r={20}
            fill="none"
            stroke="currentColor"
            strokeWidth={6}
            initial={{ pathLength: 0, scale: 0.6 }}
            animate={{ pathLength: 1, scale: [0.6, 1.05, 1] }}
            transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
          />
          {/* digit 4 mirror */}
          <motion.path
            d="M170 75 L170 35 L145 35 L145 75 M145 60 L180 60"
            fill="none"
            stroke="currentColor"
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.35 }}
          />
        </motion.svg>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.32 }}
          className="mt-3 text-3xl font-bold text-ink"
        >
          {t('notFound.title')}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72, duration: 0.32 }}
          className="mt-2 text-sm text-ink/70 max-w-sm mx-auto"
        >
          {t('notFound.message')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.86, duration: 0.32 }}
          className="mt-6 flex items-center justify-center gap-2"
        >
          <Link to="/dashboard">
            <Button leftIcon={<Home className="h-4 w-4" />}>{t('common.backToHome')}</Button>
          </Link>
          <Link to="/login">
            <Button variant="ghost" rightIcon={<ArrowLeft className="h-4 w-4" />}>
              صفحة الدخول
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
