// Journey 4: compare two developers.

import { expect, section, test } from './support.mjs';

const compareFromHome = async page => {
  await page.goto('/');
  await page.getByLabel('First username').fill('alice');
  await page.getByLabel('Second username').fill('bob');
  await page.getByRole('button', { name: 'Compare' }).click();
  await expect(page).toHaveURL(/\/compare\/alice\/bob$/);
  await expect(page.getByRole('heading', { level: 1, name: /alice\s*vs\s*bob/ })).toBeVisible();
};

test.describe('comparison', () => {
  test(
    'two profiles are compared by metrics, popularity and differences',
    { tag: '@mobile' },
    async ({ page, isMobile }) => {
      await compareFromHome(page);

      // It describes differences and never declares a winner.
      await expect(page.getByText(/does not rank developers/)).toBeVisible();
      await expect(page.getByText(/winner/i)).toHaveCount(0);

      const metrics = section(page, 'Metrics');
      const table = metrics.getByLabel('Metrics of both profiles');
      await expect(table).toBeVisible();
      const repos = table.locator('tr').filter({ hasText: 'Public repositories' });
      await expect(repos).toContainText('8');
      await expect(repos).toContainText('3');
      await expect(
        table.locator('tr').filter({ hasText: 'Profile checklist score' }),
      ).toBeVisible();
      await expect(metrics.getByText(/A dash means the value is unknown, not zero/)).toBeVisible();

      // Stars, forks and followers sit under their own heading: attention, not quality.
      await expect(table.getByText('Popularity (not quality)')).toBeVisible();
      for (const label of ['Stars', 'Forks', 'Followers']) {
        await expect(table.locator('tr').filter({ hasText: label }).first()).toBeVisible();
      }

      if (isMobile) {
        // On a phone the table becomes stacked rows: each value names its owner, and the page
        // does not scroll sideways.
        await expect(repos.getByText('alice', { exact: true })).toBeVisible();
        await expect(repos.getByText('bob', { exact: true })).toBeVisible();
      } else {
        await expect(table.getByRole('columnheader', { name: 'alice' })).toBeVisible();
        await expect(table.getByRole('columnheader', { name: 'bob' })).toBeVisible();
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      const differences = section(page, 'Differences');
      await differences.scrollIntoViewIfNeeded();
      await expect(differences.getByText('Largest differences')).toBeVisible();
      await expect(
        differences.getByText('alice has more public repositories (8 vs 3)'),
      ).toBeVisible();
      await expect(differences.getByText(/measure attention, not quality/)).toBeVisible();
      await expect(differences.getByText(/not a ranking of developers/)).toBeVisible();
      expect(page.errors).toEqual([]);
    },
  );

  test('languages, skill evidence and activity are side by side', async ({ page }) => {
    await page.goto('/compare/alice/bob');
    await expect(page.getByRole('heading', { level: 1, name: /alice\s*vs\s*bob/ })).toBeVisible();

    const languages = section(page, 'Languages');
    await expect(languages.getByText('TypeScript').first()).toBeVisible();
    await expect(languages.getByText('Jupyter Notebook').first()).toBeVisible();

    const skills = section(page, 'Skill evidence');
    await expect(skills.getByText('Backend development').first()).toBeVisible();
    await expect(skills.getByText('Data engineering').first()).toBeVisible();

    await expect(section(page, 'Activity')).toBeVisible();
    await expect(section(page, 'Profiles')).toContainText('Alice Navarro');
  });

  test('swapping the sides reverses the comparison', async ({ page }) => {
    await page.goto('/compare/alice/bob');
    await page.getByRole('link', { name: 'Swap sides' }).click();
    await expect(page).toHaveURL(/\/compare\/bob\/alice$/);
    await expect(page.getByRole('heading', { level: 1, name: /bob\s*vs\s*alice/ })).toBeVisible();
    await expect(page.getByText('alice has more public repositories (8 vs 3)')).toBeVisible();
  });
});
