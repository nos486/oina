import { expect, test, type Page } from '@playwright/test';
import { mockApi, seedProgress } from './fixtures';

const admin = { id: 'u_admin', name: 'admin', roles: ['admin', 'user'], provider: 'password' };

/** Fake Worker auth + progress endpoints; records what the app saves. */
async function mockAccount(page: Page, serverProgress: Record<string, unknown> | null) {
  const saved: Record<string, unknown>[] = [];
  await page.route('**/api/v1/auth/login', async (route) => {
    const b = route.request().postDataJSON();
    if (b.username === 'admin' && b.password === 'admin') {
      await route.fulfill({ json: { token: 't', expiresAt: new Date(Date.now() + 86400e3).toISOString(), user: admin } });
    } else await route.fulfill({ status: 401, json: { error: 'wrong' } });
  });
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: { user: admin, defaultPassword: true } }));
  await page.route('**/api/v1/progress', async (route) => {
    if (route.request().method() === 'PUT') {
      const p = route.request().postDataJSON();
      saved.push(p);
      await route.fulfill({ json: { progress: p, updatedAt: new Date().toISOString() } });
    } else {
      const latest = saved.at(-1) ?? serverProgress;
      await route.fulfill({ json: { progress: latest, updatedAt: latest ? new Date().toISOString() : null } });
    }
  });
  await page.route('**/api/v1/admin/stats', (route) =>
    route.fulfill({
      json: {
        contentVersion: 'e2e', letters: 35, words: 175, lessons: 23, stages: 6,
        needsReview: [{ id: 'omon', cyrillic: 'омон', persian: 'امان' }],
        users: 2,
        recentUsers: [{ id: 'u_admin', username: 'admin', name: 'admin', roles: ['admin'], createdAt: '', xp: 120, lessons: 3, lastProgressAt: new Date().toISOString() }],
      },
    }),
  );
  return saved;
}

test('admin signs in, server progress is merged in, and changes are saved back', async ({ page }) => {
  await mockApi(page);
  await seedProgress(page, { onboarded: true, completedLessons: ['s1-l2'], xp: 15 });
  const saved = await mockAccount(page, { version: 1, onboarded: true, completedLessons: ['s1-l1'], xp: 120 });

  await page.goto('/tools');
  await page.getByRole('link', { name: 'ورود یا ساخت حساب' }).click();
  await page.getByLabel('نام کاربری').fill('admin');
  await page.getByLabel('رمز عبور').fill('wrong');
  await page.locator('form').getByRole('button', { name: 'ورود' }).click();
  await expect(page.getByRole('alert')).toHaveText('نام کاربری یا رمز درست نیست.');

  await page.getByLabel('رمز عبور').fill('admin');
  await page.locator('form').getByRole('button', { name: 'ورود' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('رمز پیش‌فرض (admin) هنوز فعال است.')).toBeVisible();
  await expect(page.getByText('омон')).toBeVisible();
  await expect(page.getByRole('cell', { name: /admin/ })).toBeVisible();

  // Both devices' lessons are kept, the higher XP wins, and the merged copy was pushed.
  const local = await page.evaluate(() => JSON.parse(localStorage.getItem('progress:v1')!));
  expect(local.completedLessons.sort()).toEqual(['s1-l1', 's1-l2']);
  expect(local.xp).toBe(120);
  expect(saved.at(-1)?.completedLessons).toEqual(expect.arrayContaining(['s1-l1', 's1-l2']));

  // A local change is pushed shortly after.
  await page.goto('/tools');
  await expect(page.getByText('پیشرفت در حساب ذخیره شده ✓')).toBeVisible();
  const before = saved.length;
  await page.getByRole('combobox').first().selectOption('50'); // daily goal
  await expect.poll(() => saved.length, { timeout: 5000 }).toBeGreaterThan(before);
  expect(saved.at(-1)?.dailyGoal).toBe(50);
  await expect(page.getByText('پیشرفت در حساب ذخیره شده ✓')).toBeVisible();

  // Sign out clears this device's copy.
  await page.getByRole('button', { name: 'خروج از حساب' }).click();
  await expect(page.getByRole('link', { name: 'ورود یا ساخت حساب' })).toBeVisible();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('progress:v1')!));
  expect(after.completedLessons).toEqual([]);
});

test('welcome screen has no language or track choice, and links to sign-in', async ({ page }) => {
  await mockApi(page);
  await seedProgress(page);
  await page.goto('/welcome');
  await expect(page.getByText('سفر به روسیه')).toHaveCount(0);
  await expect(page.getByText(/فقط خواندن این خط را یاد می‌گیری/)).toBeVisible();
  await page.getByRole('link', { name: 'حساب داری؟ وارد شو' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
