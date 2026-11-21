import { expect, test } from '@playwright/test';
import { mockApi, seedProgress } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await seedProgress(page, { onboarded: true });
});

test('converter turns Tajik Cyrillic into Persian script and explains a word', async ({ page }) => {
  await page.goto('/converter');
  await page.getByRole('textbox').fill('Ин китоб хуб аст, ');
  await page.getByRole('button', { name: 'ҷ' }).click();
  await page.getByRole('textbox').pressSequentially('он');
  const out = page.locator('[aria-live="polite"]');
  await expect(out).toContainText('این کتاب خوب است، جان');
  await out.getByText('کتاب').click();
  await expect(page.getByText('در واژه‌نامه‌ی آینه هست')).toBeVisible();
});

test('reading room reveals a word in Persian when tapped', async ({ page }) => {
  await page.goto('/reading');
  await page.getByRole('link', { name: /نی‌نامه/ }).click();
  const word = page.getByRole('button', { name: 'Бишнав' });
  await word.click();
  await expect(page.getByRole('button', { name: 'Бишнав: بشنو' })).toBeVisible();
});

test('desktop shows a sidebar instead of the tab bar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.locator('aside').getByRole('link', { name: 'مبدل خط' })).toBeVisible();
  await expect(page.locator('nav.fixed')).toBeHidden();
  await page.locator('aside').getByRole('link', { name: 'مبدل خط' }).click();
  await expect(page).toHaveURL(/\/converter$/);
});
