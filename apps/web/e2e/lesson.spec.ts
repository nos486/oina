import { expect, test } from '@playwright/test';
import { mockApi, seedProgress } from './fixtures';

test('a new user finishes the first lesson on a 390px phone', async ({ page }) => {
  await mockApi(page);
  await seedProgress(page);
  await page.goto('/');

  // Welcome
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByText('تاجیکستان')).toBeVisible();
  await page.getByRole('button', { name: 'شروع کنیم' }).click();

  // Letter intro cards (Н, О, М)
  await expect(page).toHaveURL(/\/lesson\/s1-l1$/);
  for (let i = 0; i < 3; i++) {
    await expect(page.getByText(/حرف تازه/)).toBeVisible();
    await page.getByRole('button', { name: 'بعدی' }).click();
  }

  // Answer every question (first option each time); wrong answers come back at the end,
  // so the lesson must still finish.
  for (let i = 0; i < 60; i++) {
    if (await page.getByText('درس تمام شد!').isVisible()) break;
    const radio = page.getByRole('radio').first();
    const tile = page.locator('[aria-label="کلمه‌ی ساخته‌شده"] + div button:enabled').first();
    await expect(radio.or(tile)).toBeVisible();
    if (await radio.isVisible()) await radio.click();
    else await tile.click(); // a retry may come back as "build the word"
    await page.getByRole('button', { name: 'بررسی' }).click();
    await expect(page.getByRole('status')).toBeVisible();
    await page.getByRole('button', { name: 'ادامه' }).click();
  }
  await expect(page.getByText('درس تمام شد!')).toBeVisible();
  await expect(page.getByText('الان این کلمه‌ها را می‌توانی بخوانی:')).toBeVisible();
  await expect(page.locator('[lang="tg"]', { hasText: 'нон' }).first()).toBeVisible();

  // No horizontal scroll at 390px.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // Progress is saved and the path shows the lesson as done.
  await page.getByRole('button', { name: 'بازگشت به مسیر' }).click();
  await expect(page.getByRole('link', { name: /نان و نام، تمام‌شده/ })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('progress:v1')!));
  expect(saved.completedLessons).toContain('s1-l1');
  expect(saved.xp).toBeGreaterThan(0);
  expect(Object.keys(saved.items)).toContain('letter:n');
});

test('keyboard: 1–4 picks an option and Enter checks', async ({ page }) => {
  await mockApi(page);
  await seedProgress(page, { onboarded: true, completedLessons: ['s1-l1'], lessonLevels: { 's1-l1': 1 } });
  await page.goto('/lesson/s1-l1');
  await expect(page.getByRole('radio').first()).toBeVisible();
  await page.keyboard.press('1');
  await expect(page.getByRole('radio').first()).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toBeVisible();
});

test('alphabet hall shows all 35 letters', async ({ page }) => {
  await mockApi(page);
  await seedProgress(page, { onboarded: true });
  await page.goto('/alphabet');
  await expect(page.getByRole('heading', { name: 'تالار الفبا' })).toBeVisible();
  await expect(page.locator('main button[aria-label]')).toHaveCount(35);
});

test('a lesson left halfway resumes from the same question', async ({ page }) => {
  await mockApi(page);
  await seedProgress(page, { onboarded: true });
  await page.goto('/lesson/s1-l1');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'بعدی' }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('radio').first().click();
    await page.getByRole('button', { name: 'بررسی' }).click();
    await page.getByRole('button', { name: 'ادامه' }).click();
  }
  const before = await page.getByRole('progressbar').getAttribute('aria-valuenow');
  await page.getByRole('button', { name: 'خروج از درس' }).click();

  // The path offers to continue; the lesson opens on the same question without the intro cards.
  await expect(page.getByText('درس نیمه‌کاره')).toBeVisible();
  await page.getByRole('link', { name: 'ادامه بده' }).click();
  await expect(page.getByRole('button', { name: 'بررسی' })).toBeVisible();
  await expect(page.getByText(/حرف تازه/)).toHaveCount(0);
  expect(await page.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(before);
});

test('profile shows level, practice calendar, letter mastery and badges', async ({ page }) => {
  await mockApi(page);
  await seedProgress(page, { onboarded: true, xp: 260, badges: ['first-word'], completedLessons: ['s1-l1'] });
  await page.goto('/');
  await page.getByRole('link', { name: 'من', exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading', { name: 'روزهای تمرین' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'تسلط بر حروف' })).toBeVisible();
  await expect(page.getByText('اولین کلمه')).toBeVisible();
  await page.getByRole('link', { name: /تنظیمات/ }).click();
  await expect(page).toHaveURL(/\/tools$/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
