/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// PWA / Service Worker معطّل في Foundation (يُفعَّل في المرحلة 10)
const ENABLE_SW = process.env.VITE_ENABLE_SW === 'true';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: ENABLE_SW ? 'auto' : null,
      disable: !ENABLE_SW,
      manifest: {
        name: 'نظام إدارة بقالة',
        short_name: 'بقالتي',
        description: 'نظام إدارة بقالة أونلاين',
        theme_color: '#059669',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        dir: 'rtl',
        lang: 'ar',
        start_url: '/',
        icons: [
          // ⚠️ ستُضاف أيقونات حقيقية في المرحلة 10
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
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
    // مسموح بكل الأصول في dev — مطلوب للوصول من sandbox URLs و tunnel الإنتاج.
    // Vite 5 يدعم string[]; استخدمنا قائمة نطاقات شاملة (subdomain wildcard ".host").
    allowedHosts: ['.sandbox.novita.ai', '.railway.app', '.vercel.app', 'localhost', '127.0.0.1'],
    proxy: {
      // فقط في dev — في الإنتاج الواجهة تتحدث مع API عبر domain منفصل
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
    rollupOptions: {
      output: {
        manualChunks: {
          'ionic': ['@ionic/react', '@ionic/react-router'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query': ['@tanstack/react-query'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
