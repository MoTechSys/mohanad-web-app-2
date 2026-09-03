#!/usr/bin/env node
/**
 * scripts/p2-5-screenshots.mjs
 *
 * Captures Phase 2 P2-5 screenshots:
 *   1. login-page              — fresh login screen.
 *   2. login-error             — wrong-password error toast.
 *   3. lockout-countdown       — 429 lockout banner with MM:SS counter.
 *   4. dashboard-with-toast    — successful login + Arabic welcome toast.
 *   5. bottom-nav-sales-worker — mobile viewport, Sales Worker tabs.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import puppeteer from 'puppeteer-core';

const CHROMIUM =
  process.env.CHROMIUM_PATH ??
  '/home/user/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
const VITE = process.env.VITE_URL ?? 'http://localhost:5173';
const OUT = resolve(process.cwd(), 'docs/screenshots/phase2');

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clearAndType(page, selector, value) {
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type(selector, value, { delay: 20 });
}

async function clickSubmit(page) {
  await page.click('button[type="submit"]');
}

async function main() {
  console.log('[shots] launching Chromium…');
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  // ─── Desktop session ─────────────────────────────────────────────────
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

    // 1. Login page (fresh).
    console.log('[shots] 01-login-page');
    await page.goto(`${VITE}/login`, { waitUntil: 'networkidle0' });
    await sleep(1000);
    await page.screenshot({ path: `${OUT}/01-login-page.png`, fullPage: false });

    // 2. Login error (wrong password) → toast.
    console.log('[shots] 02-login-error');
    await page.type('input[autocomplete="username"]', 'owner', { delay: 20 });
    await page.type('input[autocomplete="current-password"]', 'WrongPass1!', { delay: 20 });
    await clickSubmit(page);
    await sleep(1800);
    await page.screenshot({ path: `${OUT}/02-login-error.png`, fullPage: false });

    // 3. Lockout countdown — 4 more wrong attempts (passwords must be ≥8 chars
    // to pass the Zod schema; otherwise the request never reaches the API).
    console.log('[shots] 03-lockout-countdown — 4 more wrong attempts');
    for (let i = 0; i < 4; i++) {
      await clearAndType(page, 'input[autocomplete="current-password"]', `WrongPass${i}!`);
      await clickSubmit(page);
      await sleep(1300);
    }
    await page
      .waitForSelector('[data-testid="lockout-banner"]', { timeout: 6000 })
      .catch(() => null);
    await sleep(700);
    await page.screenshot({ path: `${OUT}/03-lockout-countdown.png`, fullPage: false });

    await page.close();
  }

  // ─── Reset lockout via psql ─────────────────────────────────────────
  console.log('[shots] resetting owner lockout…');
  const { spawnSync } = await import('node:child_process');
  spawnSync(
    'psql',
    [
      '-U',
      'postgres',
      '-h',
      'localhost',
      '-d',
      'grocery_dev',
      '-c',
      "UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE username='owner';",
    ],
    { env: { ...process.env, PGPASSWORD: 'postgres' }, stdio: 'inherit' },
  );

  // ─── Dashboard with welcome toast (Owner) ───────────────────────────
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    console.log('[shots] 04-dashboard-with-toast');
    await page.goto(`${VITE}/login`, { waitUntil: 'networkidle0' });
    await sleep(800);
    await page.type('input[autocomplete="username"]', 'owner', { delay: 20 });
    await page.type('input[autocomplete="current-password"]', 'Owner@12345', { delay: 20 });
    await clickSubmit(page);
    // Wait for navigation to /dashboard.
    await page
      .waitForFunction(() => window.location.pathname.includes('/dashboard'), { timeout: 10000 })
      .catch(() => null);
    // Capture immediately so the welcome toast is still visible (~3.5 s).
    await sleep(1200);
    await page.screenshot({ path: `${OUT}/04-dashboard-with-toast.png`, fullPage: false });
    await page.close();
  }

  // ─── Mobile: SalesWorker bottom-nav ─────────────────────────────────
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
    console.log('[shots] 05-bottom-nav-sales-worker (mobile)');
    await page.goto(`${VITE}/login`, { waitUntil: 'networkidle0' });
    await sleep(800);
    await page.type('input[autocomplete="username"]', 'sales', { delay: 20 });
    await page.type('input[autocomplete="current-password"]', 'Test@12345', { delay: 20 });
    await clickSubmit(page);
    await page
      .waitForFunction(() => window.location.pathname.includes('/dashboard'), { timeout: 10000 })
      .catch(() => null);
    await sleep(1800);
    await page.screenshot({ path: `${OUT}/05-bottom-nav-sales-worker.png`, fullPage: false });
    await page.close();
  }

  await browser.close();
  console.log(`[shots] DONE → ${OUT}`);
}

main().catch((e) => {
  console.error('[shots] FAILED:', e);
  process.exit(1);
});
