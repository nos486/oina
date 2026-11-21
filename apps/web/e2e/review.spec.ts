import { expect, test, type Page } from '@playwright/test';
import { mockApi, seedProgress } from './fixtures';

const done = ['s1-l1', 's1-l2', 's1-l3', 's2-l1', 's2-l2'];

async function answerBlindly(page: Page, finished: RegExp) {
  for (let i = 0; i < 40; i++) {
    if (await page.getByText(finished).first().isVisible()) return;
    const radio = page.getByRole('radio').first();
    const tile = page.locator('[aria-label="کلمه‌ی ساخته‌شده"] + div button:enabled').first();
    await expect(radio.or(tile)).toBeVisible();
    if (await radio.isVisible()) await radio.click();
    else await tile.click();
    await page.getByRole('button', { name: 'بررسی' }).click();
    await page.getByRole('button', { name: 'ادامه' }).click();
  }
  await expect(page.getByText(finished).first()).toBeVisible();
}

test('the path has review nodes between lessons and asks for a review when one is due', async ({ page }) => {
  await mockApi(page);
  await seedProgress(page, { onboarded: true, completedLessons: ['s1-l1', 's1-l2'] });
  await page.goto('/');
  await expect(page.getByText('وقت مرور است!')).toBeVisible();
  await expect(page.getByRole('link', { name: /^مرور ۱ مرحله‌ی ۱/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^مرور ۱ مرحله‌ی ۵/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^مرور ۲ مرحله‌ی ۵/ })).toBeVisible();
  await page.getByRole('link', { name: 'شروع مرور' }).click();
  await expect(page).toHaveURL(/\/checkpoint\/review-s1-1$/);
  await page.getByRole('button', { name: 'شروع مرور' }).click();
  await expect(page.getByRole('button', { name: 'بررسی' })).toBeVisible();
});

test('the general exam asks 20 questions once each and saves the score', async ({ page }) => {
  await mockApi(page);
  await seedProgress(page, { onboarded: true, completedLessons: done });
  await page.goto('/review');
  await expect(page.getByRole('heading', { name: 'مرور حروف' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'مرور یک مرحله' })).toBeVisible();
  await page.getByRole('link', { name: 'رفتن به امتحان' }).click();
  await expect(page).toHaveURL(/\/exam$/);
  await page.getByRole('button', { name: 'شروع امتحان' }).click();
  await answerBlindly(page, /^نمره‌ی تو/);
  await expect(page.getByText('این‌ها را اشتباه زدی:')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('progress:v1')!));
  expect(saved.exams).toHaveLength(1);
  expect(saved.exams[0].total).toBe(20);
  await page.getByRole('button', { name: 'بازگشت به مرور' }).click();
  await page.getByRole('link', { name: 'رفتن به امتحان' }).click();
  await expect(page.getByText('امتحان‌های قبلی')).toBeVisible();
});

test('letter practice from the review tab finishes and shows a summary', async ({ page }) => {
  await mockApi(page);
  await seedProgress(page, { onboarded: true, completedLessons: done });
  await page.goto('/review');
  await page.getByRole('button', { name: 'تمرین حروف' }).click();
  await answerBlindly(page, /مرور حروف تمام شد!/);
});
