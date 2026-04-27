/**
 * Design Tokens — مصدر وحيد لكل القيم التصميمية.
 * يطابق tailwind.config.ts و css variables في theme.css.
 *
 * المرجع: docs/05-ui-ux-guidelines.md (Section 4)
 */

export const tokens = {
  // ─── Colors (Emerald) ──────────────────────────
  colors: {
    primary: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669', // ← C2
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
      950: '#022c22',
    },
    success: '#16a34a',
    warning: '#f59e0b',
    danger: '#dc2626',
    info: '#0284c7',
    surface: {
      base: '#ffffff',
      alt: '#f9fafb',
      subtle: '#f3f4f6',
    },
    text: {
      primary: '#111827',
      secondary: '#4b5563',
      tertiary: '#9ca3af',
      inverse: '#ffffff',
    },
    border: {
      DEFAULT: '#e5e7eb',
      strong: '#d1d5db',
    },
  },

  // ─── Spacing scale (rem) ───────────────────────
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },

  // ─── Typography ────────────────────────────────
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

  // ─── Radius / Shadow ───────────────────────────
  radius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
  },
  shadow: {
    card: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
    cardHover: '0 4px 6px rgba(0,0,0,0.05), 0 10px 15px rgba(0,0,0,0.06)',
  },

  // ─── Layout ────────────────────────────────────
  breakpoints: {
    desktop: 768, // C5
  },

  // ─── Animation ─────────────────────────────────
  motion: {
    durationFast: 150,
    durationBase: 250,
    durationSlow: 400,
    easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
} as const;

export type Tokens = typeof tokens;
