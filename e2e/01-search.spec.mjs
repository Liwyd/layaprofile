// Journey 1: search for a valid profile from the home page. Includes the keyboard path.

import { alert, expect, test } from './support.mjs';

test.describe('search', () => {
  test('a valid username opens the profile report', { tag: '@mobile' }, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'LayaProfile' })).toBeVisible();

    await page.getByLabel('GitHub username').fill('alice');
    await page.getByRole('button', { name: 'Analyze profile' }).click();

    await expect(page).toHaveURL(/\/user\/alice$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Alice Navarro' })).toBeVisible();
    await expect(page.getByRole('link', { name: '@alice' })).toBeVisible();
    await expect(page.getByText('Backend and frontend engineer.')).toBeVisible();
    expect(page.errors).toEqual([]);
  });

  test('an invalid username is explained and nothing is requested', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('GitHub username').fill('-not valid-');
    await page.getByRole('button', { name: 'Analyze profile' }).click();

    await expect(alert(page)).toContainText('Enter a valid GitHub username');
    await expect(page).toHaveURL(/\/$/);
  });

  test('the skip link moves focus to the main content, and the form works from there', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'A keyboard journey: it runs on the desktop project only.');
    await page.goto('/');

    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to content' });
    await expect(skipLink).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();

    // The next stop after the main landmark is the search field.
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('GitHub username')).toBeFocused();
    await page.keyboard.type('alice');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/user\/alice$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Alice Navarro' })).toBeVisible();
  });
});
