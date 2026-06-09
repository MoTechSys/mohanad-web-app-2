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

test.describe('Customers — create flow (owner)', () => {
  test('creates a customer via the modal and sees it in the list', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');

    const name = `عميل E2E ${Date.now()}`;
    const phone = `05${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

    // Open the "add customer" modal — match common add-button labels.
    const addBtn = page.getByRole('button', { name: /إضافة|عميل جديد|\+/ }).first();
    await addBtn.click();

    // Fill the form (inputs are RTL Arabic; target by placeholder/label text).
    await page.getByLabel(/الاسم/).first().fill(name);
    const phoneField = page.getByLabel(/الهاتف|الجوال|رقم/).first();
    if (await phoneField.count()) await phoneField.fill(phone);

    // Submit (save) button inside the modal.
    await page
      .getByRole('button', { name: /حفظ|إضافة|إنشاء/ })
      .last()
      .click();

    // The new customer name should appear in the list.
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10_000 });
  });
});
