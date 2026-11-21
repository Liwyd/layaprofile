// Journey 2: profile analytics (overview, languages, year chart, profile quality).

import { expect, openProfile, section, stat, test } from './support.mjs';

test.describe('profile analytics', () => {
  test('the overview shows the account and counts both repository pages', async ({ page }) => {
    await openProfile(page, 'alice', 'Alice Navarro');
    const overview = section(page, 'Overview');

    await expect(overview.getByText('Lisbon, Portugal')).toBeVisible();
    await expect(overview.getByRole('link', { name: 'https://alice.example.dev' })).toBeVisible();
    await expect(stat(page, 'Public repos')).toHaveText('9');
    await expect(stat(page, 'Followers')).toHaveText('128');
    await expect(stat(page, 'Following')).toHaveText('14');
    // Alice has nine repositories, served in two pages of five and four: eight own plus one fork.
    await expect(stat(page, 'Own repos')).toHaveText('8');
    await expect(stat(page, 'Forked repos')).toHaveText('1');
    await expect(overview.getByText(/of 60 left/)).toBeVisible();
    await expect(overview.getByText(/Fetched .* · (live|cached)$/)).toBeVisible();
  });

  test('languages, the year chart and its table alternative', async ({ page }) => {
    await openProfile(page, 'alice', 'Alice Navarro');
    const activity = section(page, 'Activity & languages');

    // Repository counts per primary language (own, non-fork).
    const languages = activity.getByRole('list').filter({ hasText: 'TypeScript' }).first();
    await expect(languages.getByRole('listitem').filter({ hasText: /^TypeScript/ })).toHaveText(
      /TypeScript\s*2\s*repositories/,
    );
    await expect(languages.getByRole('listitem').filter({ hasText: /^Go/ })).toHaveText(
      /Go\s*2\s*repositories/,
    );
    await expect(activity.getByText('Not lines of code or skill level.')).toBeVisible();

    // The chart is drawn on a canvas with a text alternative.
    const chart = activity.getByRole('img', { name: /Bar chart of own repositories by year/ });
    await expect(chart).toBeVisible();
    await expect
      .poll(() =>
        chart.evaluate(canvas => {
          const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
          return data.some((value, index) => index % 4 === 3 && value !== 0);
        }),
      )
      .toBe(true);

    await activity.getByText('View as table').click();
    const table = activity.getByRole('table', {
      name: 'Own repositories created and last pushed per year',
    });
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader')).toHaveText(['Year', 'Created', 'Last pushed']);
    // Every own repository is created in exactly one year and last pushed in exactly one year.
    for (const column of [2, 3]) {
      const cells = await table.locator(`tbody tr td:nth-child(${column})`).allTextContents();
      expect(cells.map(Number).reduce((sum, value) => sum + value, 0)).toBe(8);
    }

    await expect(activity.getByText('214 stars')).toBeVisible();
    await expect(activity.getByText(/Based on created_at and pushed_at/)).toBeVisible();
  });

  test(
    'profile quality shows score, label and coverage, and each dimension shows its checks',
    { tag: '@mobile' },
    async ({ page }) => {
      await openProfile(page, 'alice', 'Alice Navarro');
      const quality = section(page, 'Profile quality');

      await expect(quality.getByText(/^\d+$/).first()).toBeVisible();
      await expect(quality.getByText('/100')).toBeVisible();
      // Alice's public data is well presented: never "Needs improvement" or "Insufficient".
      await expect(quality.getByText(/^(Excellent|Good)$/)).toBeVisible();
      await expect(quality.getByText('Evidence coverage')).toBeVisible();
      await expect(quality.getByText(/^\d+%$/).first()).toBeVisible();

      for (const dimension of ['Identity', 'Repository presentation', 'Maintenance']) {
        await expect(quality.locator('summary').filter({ hasText: dimension })).toBeVisible();
      }

      // Expanding a dimension lists its checks with their evidence status.
      const identity = quality.locator('details').filter({ hasText: 'Identity' }).first();
      await identity.locator('summary').click();
      await expect(identity.getByText('Biography', { exact: true })).toBeVisible();
      await expect(identity.getByText('Profile README', { exact: true })).toBeVisible();
      await expect(identity.getByText('verified', { exact: true }).first()).toBeVisible();
      await expect(identity.getByText(/^\d+(\.\d+)?\/\d+$/).first()).toBeVisible();

      // Data GitHub does not expose is tagged unknown and left out of the score, never zero.
      const presentation = quality
        .locator('details')
        .filter({ hasText: 'Repository presentation' })
        .first();
      await presentation.locator('summary').click();
      await expect(presentation.getByText('Pinned repositories')).toBeVisible();
      await expect(presentation.getByText('unknown', { exact: true })).toBeVisible();
      await expect(presentation.getByText('not available via the public REST API')).toBeVisible();

      // Rule based checks are tagged as such, apart from verified facts.
      const maintenance = quality.locator('details').filter({ hasText: 'Maintenance' }).first();
      await maintenance.locator('summary').click();
      await expect(maintenance.getByText('rule', { exact: true }).first()).toBeVisible();

      await quality
        .locator('summary')
        .filter({ hasText: /^Unknown\s*\d+$/ })
        .click();
      await expect(quality.getByText(/Excluded from the score, not counted as zero/)).toBeVisible();
      await expect(quality.getByText('Improvement checklist')).toBeVisible();
      await expect(
        quality.getByText(/not an industry benchmark\. Popularity is not scored/),
      ).toBeVisible();
    },
  );
});
