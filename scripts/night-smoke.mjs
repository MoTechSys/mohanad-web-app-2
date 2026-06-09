#!/usr/bin/env node
/**
 * scripts/night-smoke.mjs — autonomous frontend smoke for the night pass.
 * Logs in as owner, visits every page, screenshots, collects console errors.
 * Output: docs/phase-night/screenshots/
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROMIUM = process.env.CHROMIUM_PATH ?? '/usr/local/bin/chromium-browser';
const VITE = process.env.VITE_URL ?? 'http://localhost:5173';
const USER = process.env.SEED_OWNER_USERNAME ?? 'owner';
const PASS = process.env.SEED_OWNER_PASSWORD ?? 'Owner@12345';
const OUT = resolve(process.cwd(), 'docs/phase-night/screenshots');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGES = [
  ['dashboard', '/dashboard'],
  ['customers', '/customers'],
  ['suppliers', '/suppliers'],
  ['sales', '/sales'],
  ['purchases', '/purchases'],
  ['expenses', '/expenses'],
  ['daily-income', '/daily-income'],
  ['products', '/products'],
  ['inventory', '/inventory'],
  ['reports', '/reports'],
  ['notifications', '/notifications'],
  ['audit', '/audit'],
  ['settings', '/settings'],
  ['users', '/admin/users'],
  ['roles', '/admin/roles'],
  ['account', '/account'],
];

const errors = [];

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${page.url()} :: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${page.url()} :: ${e.message}`));
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (u.includes('/api/')) errors.push(`[reqfail] ${u} :: ${r.failure()?.errorText}`);
  });

  // Login
  await page.goto(`${VITE}/login`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('input[autocomplete="username"]', { timeout: 15000 });
  await page.type('input[autocomplete="username"]', USER, { delay: 15 });
  await page.type('input[autocomplete="current-password"]', PASS, { delay: 15 });
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 12000 });
  await sleep(800);
  console.log('[night-smoke] logged in OK');

  for (const [name, path] of PAGES) {
    try {
      await page.goto(`${VITE}${path}`, { waitUntil: 'networkidle0', timeout: 20000 });
      await sleep(600);
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
      const title = await page.title();
      console.log(`[night-smoke] ✓ ${name} (${path}) — ${title}`);
    } catch (e) {
      errors.push(`[nav] ${path} :: ${e.message}`);
      console.log(`[night-smoke] ✗ ${name} (${path}) — ${e.message}`);
    }
  }

  await browser.close();
  console.log(`\n[night-smoke] errors collected: ${errors.length}`);
  for (const e of errors) console.log('  - ' + e);
  process.exit(errors.length > 0 ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
