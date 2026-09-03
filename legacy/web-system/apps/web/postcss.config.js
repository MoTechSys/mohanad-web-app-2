/**
 * PostCSS configuration — required for Vite to run the Tailwind +
 * Autoprefixer pipeline. Without this file the build pass-through copies
 * `@tailwind base/components/utilities` directives verbatim into the output
 * CSS and the page renders unstyled.
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
