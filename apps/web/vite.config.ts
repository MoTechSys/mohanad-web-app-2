/// <reference types="vitest" />
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Vite configuration — Foundation
 *
 *   • Service Worker: enabled by default (Q8) — caches static assets only.
 *   • API requests bypass the SW (NetworkOnly) so financial endpoints
 *     never hit a stale cache.
 *   • Aliases: `@` → src, `@grocery/shared` → workspace package.
 *   • Manual chunks split out Ionic, React vendor, TanStack Query and
 *     Framer Motion to keep the entrypoint lean.
 *
 * Disable the SW with `VITE_ENABLE_SW=false` in dev when iterating fast.
 */
const ENABLE_SW = process.env.VITE_ENABLE_SW !== 'false';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' lets the user decide when to apply an update — important
      // for an app that may be mid-transaction when a new build ships.
      registerType: 'prompt',
      injectRegister: 'auto',
      disable: !ENABLE_SW,
      includeAssets: [
        'favicon.svg',
        'offline.html',
        'icons/icon-72.svg',
        'icons/icon-96.svg',
        'icons/icon-128.svg',
        'icons/icon-144.svg',
        'icons/icon-152.svg',
        'icons/icon-192.svg',
        'icons/icon-384.svg',
        'icons/icon-512.svg',
        'icons/icon-maskable-512.svg',
      ],
      // We ship a hand-written manifest at /public/manifest.webmanifest
      // (rich metadata, RTL, full icon ladder). Tell the plugin not to
      // generate one from this config.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,png,webmanifest}'],
        navigateFallback: '/offline.html',
        // /api/* and /health must NEVER hit the cache nor fall back to
        // the SPA shell — they are live financial endpoints.
        navigateFallbackDenylist: [/^\/api\//, /^\/health$/, /^\/api\/v1\//],
        runtimeCaching: [
          {
            // Hard NetworkOnly for the entire API surface.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
            options: { cacheName: 'api-no-cache' },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/health'),
            handler: 'NetworkOnly',
            options: { cacheName: 'health-no-cache' },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@grocery/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL ?? 'http://localhost:3001',
        changeOrigin: true,
      },
      '/health': {
        target: process.env.VITE_API_URL ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Function form lets us keep React + React-DOM + React-Router +
        // Ionic in ONE vendor chunk. Splitting them apart creates a
        // circular Rollup chunk graph (`ionic` <-> `react-vendor`) which
        // under terser minification triggers a TDZ error
        // ("Cannot access 'y' before initialization") at runtime.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@tanstack/react-query')) return 'query';
          if (id.includes('framer-motion')) return 'motion';
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('react-router') ||
            id.includes('@ionic/') ||
            id.includes('ionicons')
          ) {
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // Unit tests live under src/; e2e/ is Playwright (run via `pnpm e2e`).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
