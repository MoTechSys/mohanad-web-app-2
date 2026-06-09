import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E config (Phase 10).
 *
 * Targets the running dev stack (web :5173 → api :3010 via Vite proxy).
 * Uses the system Chromium (Chrome-for-Testing) so no `playwright install`
 * download is required in this environment.
 *
 * Run:  pnpm --filter @grocery/web e2e
 * Env:  E2E_BASE_URL (default http://localhost:5173)
 *       CHROMIUM_PATH (default /usr/local/bin/chromium-browser)
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/usr/local/bin/chromium-browser';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'ar',
    headless: true,
    viewport: { width: 1280, height: 900 },
    // Force the system Chromium (avoids Playwright's bundled chrome-headless-shell).
    launchOptions: {
      executablePath: CHROMIUM,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
