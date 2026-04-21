import { expect, test, type Page } from '@playwright/test';

test('main app smoke test covers the basic pantry-to-recipe journey', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('http://localhost:5173/');

  await expect(page.getByRole('heading', { name: /dinner from what you already have|dinner tonight\./i })).toBeVisible();

  await page.getByRole('link', { name: /^pantry$/i }).click();
  await expect(page.getByRole('heading', { name: /add what you already have/i })).toBeVisible();

  for (const ingredient of ['eggs', 'rice', 'onion']) {
    await addPantryItem(page, ingredient);
  }

  const pantrySection = page.locator('section').filter({
    has: page.getByRole('heading', { name: /current pantry/i }),
  });
  await expect(pantrySection).toContainText(/egg|eggs/i);
  await expect(pantrySection).toContainText('rice');
  await expect(pantrySection).toContainText('onion');

  await page.getByRole('link', { name: /view recommendations/i }).click();
  await expect(page.getByRole('heading', { name: /a clear dinner decision from your current pantry/i })).toBeVisible();

  const recipeLinks = page.locator('a[href^="/recipes/"]');
  await expect(recipeLinks.first()).toBeVisible({ timeout: 60000 });

  await recipeLinks.first().click();

  await expect(page).toHaveURL(/\/recipes\/[^/]+$/);
  await expect(page.locator('h1')).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('heading', { name: /ingredients/i })).toBeVisible();
});

async function addPantryItem(page: Page, ingredient: string) {
  await page.getByLabel('Ingredient').fill(ingredient);
  await page.getByRole('button', { name: /^add item$/i }).click();

  await expect(page.getByText(new RegExp(`Added ${escapeRegExp(ingredient)}\\.`, 'i'))).toBeVisible();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
