/**
 * Design Tokens — single runtime source of truth.
 *
 * Mirrors `tailwind.config.ts` (compile-time) and the CSS variables
 * declared in `src/styles/globals.css`.
 *
 * Reference: docs/05-ui-ux-guidelines.md (Section 4)
 */

export const tokens = {
  colors: {
    primary: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
      950: '#022c22',
    },
    success: '#16a34a',
    warning: '#f59e0b',
    danger: '#dc2626',
    info: '#0284c7',
    surface: { base: '#ffffff', alt: '#f9fafb', subtle: '#f3f4f6' },
    ink: {
      primary: '#111827',
      soft: '#4b5563',
      muted: '#9ca3af',
      inverse: '#ffffff',
    },
    border: { DEFAULT: '#e5e7eb', strong: '#d1d5db' },
  },

  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },

  fontFamily: {
    sans: '"IBM Plex Sans Arabic", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  radius: {
    sm: '0.375rem',
    md: '0.625rem',
    lg: '0.875rem',
    xl: '1rem',
    '2xl': '1.25rem',
    '3xl': '1.75rem',
    full: '9999px',
  },
  shadow: {
    card: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
    cardHover: '0 4px 12px rgba(0,0,0,0.06), 0 12px 24px -8px rgba(0,0,0,0.08)',
    sheet: '0 -4px 16px rgba(0,0,0,0.08)',
    glow: '0 0 0 1px rgba(5,150,105,0.18), 0 8px 30px rgba(5,150,105,0.18)',
    focusRing: '0 0 0 3px rgba(5,150,105,0.18), 0 0 0 1px rgba(5,150,105,0.85)',
  },

  breakpoints: { desktop: 768 },

  motion: {
    durationFast: 150,
    durationBase: 250,
    durationSlow: 400,
    easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

export type Tokens = typeof tokens;

/** Common framer-motion variants the app re-uses. */
export const motionVariants = {
  fadeInUp: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
  },
  stagger: (delay = 0.06) => ({
    initial: {},
    animate: {
      transition: {
        staggerChildren: delay,
        delayChildren: 0.05,
      },
    },
  }),
} as const;
