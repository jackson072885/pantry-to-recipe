import { test, expect } from '@playwright/test';

test('recipe browser smoke test', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('http://localhost:5173/recipe-browser');
  const resultsMeta = page.getByLabel('Result count and sort');

  await expect(page.getByRole('heading', { name: /recipe browser/i })).toBeVisible();
  await expect(resultsMeta).toContainText(/eligible recipes?/i, { timeout: 60000 });

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

  await page.getByRole('tab', { name: /cost filters/i }).click();
  await expect(page.getByRole('button', { name: /budget/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /moderate/i })).toBeVisible();

  await page.getByRole('tab', { name: /cleanup filters/i }).click();
  await expect(page.getByRole('button', { name: /one pan/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /one pot/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /sheet pan/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /multi pan/i })).toBeVisible();

  await page.getByRole('tab', { name: /household filters/i }).click();
  await expect(page.getByRole('button', { name: /weeknight add/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /meal prep add/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /kid-friendly add/i })).toBeVisible();

  await page.getByRole('button', { name: /weeknight add/i }).click();
  await expect(page.locator('.browser-active-filter-chip').filter({ hasText: 'Household' }).filter({ hasText: 'Weeknight' })).toBeVisible();

  await page.getByRole('tab', { name: /protein filters/i }).click();
  await page.getByRole('button', { name: /beef add/i }).click();

  await page.getByRole('tab', { name: /diet filters/i }).click();
  await expect(page.getByRole('button', { name: /vegetarian/i })).toBeVisible();
  await page.getByRole('button', { name: /vegetarian add/i }).click();

  await expect(resultsMeta).toContainText('0 eligible recipes', { timeout: 60000 });
  await expect(page.getByRole('heading', { name: /no recipes match this browser state/i })).toBeVisible();
  await expect(page.getByLabel('Recipe Browser recovery actions')).toBeVisible();
  await expect(page.getByRole('button', { name: /remove latest filter: vegetarian/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /clear diet filter/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /clear all filters/i })).toBeVisible();
});
