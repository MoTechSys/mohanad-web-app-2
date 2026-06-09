import { expect, test } from '@playwright/test';

const USER = process.env.SEED_OWNER_USERNAME ?? 'owner';
const PASS = process.env.SEED_OWNER_PASSWORD ?? 'Owner@12345';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[autocomplete="username"]', USER);
  await page.fill('input[autocomplete="current-password"]', PASS);
  await page.click('button[type="submit"]');
  await expect(page).not.toHaveURL(/\/login/, { timeout: 12_000 });
});

const PAGES: Array<[string, string]> = [
  ['customers', '/customers'],
  ['suppliers', '/suppliers'],
  ['sales', '/sales'],
  ['purchases', '/purchases'],
  ['expenses', '/expenses'],
  ['reports', '/reports'],
  ['settings', '/settings'],
];

test.describe('Authenticated navigation (owner)', () => {
  for (const [name, path] of PAGES) {
    test(`loads ${name} without console errors or Eastern-Arabic digits`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error' && !m.text().includes('401')) errors.push(m.text());
      });
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(new RegExp(path));
      const body = await page.locator('body').innerText();
      expect(body, 'no Eastern-Arabic numerals (golden decision C3)').not.toMatch(/[٠-٩]/);
      expect(errors, `console errors on ${path}`).toEqual([]);
    });
  }
});
