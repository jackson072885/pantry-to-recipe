import { test, expect } from '@playwright/test';

test('recipe browser smoke test', async ({ page }) => {
  await page.goto('http://localhost:5173/recipe-browser');

  await expect(page.getByRole('heading', { name: /recipe browser/i })).toBeVisible();

  await expect(page.getByRole('button', { name: /explore all/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /cook now/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /almost there/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /pantry stretch/i })).toBeVisible();

  await expect(page.getByRole('tab', { name: /ingredients filters/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /protein filters/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /cost filters/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /cleanup filters/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /diet filters/i })).toBeVisible();

  await page.getByRole('tab', { name: /protein filters/i }).click();

  await expect(page.getByRole('button', { name: /chicken add/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /beef add/i })).toBeVisible();
});
