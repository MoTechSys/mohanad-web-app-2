import { expect, test } from '@playwright/test';

const USER = process.env.SEED_OWNER_USERNAME ?? 'owner';
const PASS = process.env.SEED_OWNER_PASSWORD ?? 'Owner@12345';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('input[autocomplete="username"]', USER);
  await page.fill('input[autocomplete="current-password"]', PASS);
  await page.click('button[type="submit"]');
  await expect(page).not.toHaveURL(/\/login/, { timeout: 12_000 });
}

test.describe('Auth + RBAC', () => {
  test('rejects invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[autocomplete="username"]', USER);
    await page.fill('input[autocomplete="current-password"]', 'wrong-password');
    await page.click('button[type="submit"]');
    // Stays on login (no redirect to an authed route).
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/login/);
  });

  test('owner logs in and reaches the dashboard', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/(dashboard)?$|\/dashboard/);
    // Dashboard shows Arabic content; no Eastern-Arabic numerals (C3).
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/[٠-٩]/);
  });

  test('protected route redirects to login when unauthenticated', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/customers');
    await expect(page).toHaveURL(/\/login/, { timeout: 12_000 });
  });
});
