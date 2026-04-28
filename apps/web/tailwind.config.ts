import type { Config } from 'tailwindcss';
import rtl from 'tailwindcss-rtl';

/**
 * Tailwind configuration — single source of design tokens.
 * Mirrored at runtime by `src/design/tokens.ts` and CSS variables
 * in `src/styles/globals.css`.
 *
 * Reference: docs/05-ui-ux-guidelines.md (Section 4)
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // ─── Colors (Emerald primary) ───────────────
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
        surface: {
          DEFAULT: '#ffffff',
          alt: '#f9fafb',
          subtle: '#f3f4f6',
        },
        ink: {
          DEFAULT: '#111827',
          soft: '#4b5563',
          muted: '#9ca3af',
          inverse: '#ffffff',
        },
      },
      fontFamily: {
        sans: [
          '"IBM Plex Sans Arabic"',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],
        sm: ['0.9375rem', { lineHeight: '1.4rem' }],
        base: ['1rem', { lineHeight: '1.6rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.85rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.5rem',
        md: '0.625rem',
        lg: '0.875rem',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.06), 0 12px 24px -8px rgba(0,0,0,0.08)',
        sheet: '0 -4px 16px rgba(0,0,0,0.08)',
        glow: '0 0 0 1px rgba(5,150,105,0.18), 0 8px 30px rgba(5,150,105,0.18)',
        'inner-soft': 'inset 0 1px 2px rgba(15,23,42,0.04)',
        'focus-ring': '0 0 0 3px rgba(5,150,105,0.18), 0 0 0 1px rgba(5,150,105,0.85)',
      },
      backgroundImage: {
        'gradient-emerald':
          'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 35%, #a7f3d0 70%, #6ee7b7 100%)',
        'gradient-glass':
          'linear-gradient(135deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.55) 100%)',
        grain:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
      backdropBlur: {
        xs: '2px',
      },
      screens: {
        desktop: '768px',
      },
      transitionTimingFunction: {
        emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '250ms',
        slow: '400ms',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.7' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 280ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [rtl],
};

export default config;
