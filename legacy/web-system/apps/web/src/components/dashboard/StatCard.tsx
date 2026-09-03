import { motion, useMotionValue, useTransform } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, type LucideIcon, Minus } from 'lucide-react';
import { type MouseEvent, useRef } from 'react';

import { cn } from '@/lib/cn';
import { Sparkline } from './Sparkline';

/**
 * StatCard — KPI tile with optional sparkline & subtle 3D tilt on hover.
 *
 *   • Magnetic 3D tilt (mouse-driven, max ±6°) — disabled on touch devices.
 *   • Optional `delta` shows trend with up/down/flat icon.
 *   • Optional `series` renders a small sparkline beneath the value.
 *
 * The component is dependency-light: only framer-motion + lucide-react.
 */
export interface StatCardProps {
  label: string;
  value: string | number;
  /** e.g. "+12.4%" */
  delta?: string;
  /** Trend direction — controls icon + colour. */
  trend?: 'up' | 'down' | 'flat';
  icon?: LucideIcon;
  /** Numeric series for the optional sparkline. */
  series?: number[];
  /** Tailwind classes for the icon's tinted background. */
  iconClassName?: string;
  className?: string;
}

const trendConfig = {
  up: { icon: ArrowUpRight, color: 'text-success', bg: 'bg-success/10' },
  down: { icon: ArrowDownRight, color: 'text-danger', bg: 'bg-danger/10' },
  flat: { icon: Minus, color: 'text-gray-500', bg: 'bg-gray-100' },
} as const;

export function StatCard({
  label,
  value,
  delta,
  trend = 'flat',
  icon: Icon,
  series,
  iconClassName,
  className,
}: StatCardProps): JSX.Element {
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-50, 50], [6, -6]);
  const rotateY = useTransform(x, [-50, 50], [-6, 6]);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    x.set(e.clientX - r.left - r.width / 2);
    y.set(e.clientY - r.top - r.height / 2);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  const trendCfg = trendConfig[trend];
  const TrendIcon = trendCfg.icon;

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX, rotateY, transformPerspective: 800 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-gray-200 bg-surface p-5',
        'shadow-card hover:shadow-card-hover transition-shadow duration-base ease-emphasized',
        'will-change-transform',
        className,
      )}
    >
      {/* Subtle tinted glow on hover */}
      <motion.span
        aria-hidden
        className="absolute -top-12 -end-12 h-32 w-32 rounded-full bg-primary-100/60 blur-2xl opacity-0"
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      />

      <div className="relative z-[1] flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="text-2xl desktop:text-3xl font-bold text-ink num">{value}</p>
        </div>
        {Icon ? (
          <div
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-700',
              iconClassName,
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </div>
        ) : null}
      </div>

      <div className="relative z-[1] mt-3 flex items-end justify-between gap-3">
        {delta ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
              trendCfg.bg,
              trendCfg.color,
            )}
          >
            <TrendIcon className="h-3.5 w-3.5" aria-hidden />
            {delta}
          </span>
        ) : (
          <span aria-hidden />
        )}
        {series && series.length > 1 ? <Sparkline data={series} /> : null}
      </div>
    </motion.div>
  );
}
