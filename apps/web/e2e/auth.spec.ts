import { expect, test } from '@playwright/test';
import { mockApi, seedProgress } from './fixtures';

test('admin signs in from Tools and sees the admin page', async ({ page }) => {
  await mockApi(page);
  await seedProgress(page, { onboarded: true });
  const user = { id: 'password:admin', name: 'admin', roles: ['admin'], provider: 'password' };
  await page.route('**/api/v1/auth/login', async (route) => {
    const body = route.request().postDataJSON();
    if (body.username === 'admin' && body.password === 'admin') {
      await route.fulfill({ json: { token: 't', expiresAt: new Date(Date.now() + 86400e3).toISOString(), user } });
    } else await route.fulfill({ status: 401, json: { error: 'wrong' } });
  });
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: { user, defaultPassword: true } }));
  await page.route('**/api/v1/admin/stats', (route) =>
    route.fulfill({ json: { contentVersion: 'e2e', letters: 35, words: 175, lessons: 23, audioFiles: 0, needsReview: [{ id: 'omon', cyrillic: 'омон', persian: 'امان' }] } }),
  );

  await page.goto('/tools');
  await page.getByRole('link', { name: 'ورود' }).click();
  await page.getByLabel('نام کاربری').fill('admin');
  await page.getByLabel('رمز عبور').fill('wrong');
  await page.getByRole('button', { name: 'ورود' }).click();
  await expect(page.getByRole('alert')).toHaveText('نام کاربری یا رمز درست نیست.');

  await page.getByLabel('رمز عبور').fill('admin');
  await page.getByRole('button', { name: 'ورود' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('رمز پیش‌فرض (admin) هنوز فعال است.')).toBeVisible();
  await expect(page.getByText('омон')).toBeVisible();

  await page.goto('/tools');
  await expect(page.getByText('مدیر', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'خروج از حساب' }).click();
  await expect(page.getByRole('link', { name: 'ورود' })).toBeVisible();
});

test('welcome screen has no language or track choice', async ({ page }) => {
  await mockApi(page);
  await seedProgress(page);
  await page.goto('/welcome');
  await expect(page.getByText('سفر به روسیه')).toHaveCount(0);
  await expect(page.getByText(/فقط خواندن این خط را یاد می‌گیری/)).toBeVisible();
});
