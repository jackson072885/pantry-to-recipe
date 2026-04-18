import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('recipe browser smoke test', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('http://localhost:5173/recipe-browser');
  const resultsMeta = page.getByLabel('Result count and sort');
  const recoveryActions = page.getByLabel('Recipe Browser recovery actions');

  await expect(page.getByRole('heading', { name: /recipe browser/i })).toBeVisible();
  await expect(resultsMeta).toContainText(/eligible recipes?/i, { timeout: 60000 });
  await expect(recoveryActions).toBeHidden();

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
  await expect(page.getByRole('button', { name: /chicken & poultry add/i })).toBeVisible();
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
  await expect(page.getByRole('button', { name: /remove weeknight from household/i })).toBeVisible();
  await expect(recoveryActions).toBeHidden();

  await page.getByRole('tab', { name: /protein filters/i }).click();
  await page.getByRole('button', { name: /beef add/i }).click();
  await expect(recoveryActions).toBeHidden();

  await page.getByRole('tab', { name: /diet filters/i }).click();
  await expect(page.getByRole('button', { name: /vegetarian/i })).toBeVisible();
  await page.getByRole('button', { name: /vegetarian add/i }).click();

  await expect(resultsMeta).toContainText('0 eligible recipes', { timeout: 60000 });
  await expect(page.getByRole('heading', { name: /no recipes match this browser state/i })).toBeVisible();
  await expect(recoveryActions).toBeVisible();
  await expect(page.getByRole('button', { name: /remove weeknight from household/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /remove beef from protein/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /remove vegetarian from diet/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /remove latest filter: vegetarian/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /clear diet filter/i })).toBeVisible();
  const clearAllFiltersButton = page.getByRole('button', { name: /clear all filters/i });
  await expect(clearAllFiltersButton).toBeVisible();

  await clearAllFiltersButton.click();

  await expect(page.getByRole('heading', { name: /no recipes match this browser state/i })).toBeHidden();
  await expect(resultsMeta).not.toContainText('0 eligible recipes');
  await expect(resultsMeta).toContainText(/[1-9]\d* eligible recipes?/i, { timeout: 60000 });
  await expect(page.getByRole('button', { name: /remove weeknight from household/i })).toBeHidden();
  await expect(page.getByRole('button', { name: /remove beef from protein/i })).toBeHidden();
  await expect(page.getByRole('button', { name: /remove vegetarian from diet/i })).toBeHidden();
});

test('recipe browser removes latest filter for stepwise recovery', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('http://localhost:5173/recipe-browser');
  const resultsMeta = page.getByLabel('Result count and sort');

  await expect(page.getByRole('heading', { name: /recipe browser/i })).toBeVisible();
  await expect(resultsMeta).toContainText(/eligible recipes?/i, { timeout: 60000 });

  await page.getByRole('tab', { name: /household filters/i }).click();
  await page.getByRole('button', { name: /weeknight add/i }).click();
  await expect(page.getByRole('button', { name: /remove weeknight from household/i })).toBeVisible();

  await page.getByRole('tab', { name: /protein filters/i }).click();
  await page.getByRole('button', { name: /beef add/i }).click();
  await expect(page.getByRole('button', { name: /remove beef from protein/i })).toBeVisible();

  await page.getByRole('tab', { name: /diet filters/i }).click();
  await page.getByRole('button', { name: /vegetarian add/i }).click();

  await expect(resultsMeta).toContainText('0 eligible recipes', { timeout: 60000 });
  await expect(page.getByRole('heading', { name: /no recipes match this browser state/i })).toBeVisible();

  await page.getByRole('button', { name: /remove latest filter: vegetarian/i }).click();

  await expect(page.getByRole('heading', { name: /no recipes match this browser state/i })).toBeHidden();
  await expect(resultsMeta).not.toContainText('0 eligible recipes');
  await expect(resultsMeta).toContainText(/[1-9]\d* eligible recipes?/i, { timeout: 60000 });
  await expect(page.getByRole('button', { name: /remove vegetarian from diet/i })).toBeHidden();
  await expect(page.getByRole('button', { name: /remove weeknight from household/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /remove beef from protein/i })).toBeVisible();
});

test('recipe browser clears only diet filters for family-scoped recovery', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('http://localhost:5173/recipe-browser');
  const resultsMeta = page.getByLabel('Result count and sort');
  const recoveryActions = page.getByLabel('Recipe Browser recovery actions');
  const recoveryActionButtons = recoveryActions.getByRole('button');
  const removeLatestFilterButton = recoveryActions.getByRole('button', {
    name: /remove latest filter: vegetarian/i,
  });
  const clearDietFilterButton = recoveryActions.getByRole('button', { name: /clear diet filter/i });
  const clearAllFiltersButton = recoveryActions.getByRole('button', { name: /clear all filters/i });

  await expect(page.getByRole('heading', { name: /recipe browser/i })).toBeVisible();
  await expect(resultsMeta).toContainText(/eligible recipes?/i, { timeout: 60000 });

  await page.getByRole('tab', { name: /household filters/i }).click();
  await page.getByRole('button', { name: /weeknight add/i }).click();
  await expect(page.getByRole('button', { name: /remove weeknight from household/i })).toBeVisible();

  await page.getByRole('tab', { name: /protein filters/i }).click();
  await page.getByRole('button', { name: /beef add/i }).click();
  await expect(page.getByRole('button', { name: /remove beef from protein/i })).toBeVisible();

  await page.getByRole('tab', { name: /diet filters/i }).click();
  await page.getByRole('button', { name: /vegetarian add/i }).click();

  await expect(resultsMeta).toContainText('0 eligible recipes', { timeout: 60000 });
  await expect(page.getByRole('heading', { name: /no recipes match this browser state/i })).toBeVisible();
  await expect(recoveryActions).toBeVisible();
  await expect(recoveryActionButtons).toHaveCount(3);
  await expect(recoveryActionButtons).toHaveText([
    'Remove latest filter: Vegetarian',
    'Clear Diet filter',
    'Clear all filters',
  ]);
  await expect(removeLatestFilterButton).toBeVisible();
  await expect(clearDietFilterButton).toBeVisible();
  await expect(clearAllFiltersButton).toBeVisible();
  await expect(recoveryActions.getByRole('button', { name: /clear household filter/i })).toBeHidden();
  await expect(recoveryActions.getByRole('button', { name: /clear protein filter/i })).toBeHidden();
  await expect(recoveryActions.getByRole('button', { name: /show closest eligible matches in explore all/i })).toBeHidden();

  await clearDietFilterButton.click();

  await expect(page.getByRole('heading', { name: /no recipes match this browser state/i })).toBeHidden();
  await expect(recoveryActions).toBeHidden();
  await expect(resultsMeta).not.toContainText('0 eligible recipes');
  await expect(resultsMeta).toContainText(/[1-9]\d* eligible recipes?/i, { timeout: 60000 });
  await expect(page.getByRole('button', { name: /remove vegetarian from diet/i })).toBeHidden();
  await expect(removeLatestFilterButton).toBeHidden();
  await expect(clearDietFilterButton).toBeHidden();
  await expect(clearAllFiltersButton).toBeHidden();
  await expect(page.getByRole('button', { name: /remove weeknight from household/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /remove beef from protein/i })).toBeVisible();
});
