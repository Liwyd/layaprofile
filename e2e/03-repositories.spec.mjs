// Journey 3: repository quality analysis, one repository and the top five.

import { choose, expect, openProfile, section, test } from './support.mjs';

test.describe('repository quality', () => {
  test('analyzing a repository shows its dimensions, project type and Laya assessment', async ({
    page,
  }) => {
    await openProfile(page, 'alice', 'Alice Navarro');
    const repositories = section(page, 'Repositories');

    await repositories.getByRole('button', { name: 'Analyze: web-dashboard' }).click();
    const panel = repositories.getByRole('region', { name: 'Analysis of web-dashboard' });

    // Deterministic score, label and coverage.
    await expect(panel.getByText('/100')).toBeVisible();
    await expect(panel.getByText('Excellent', { exact: true })).toBeVisible();
    await expect(panel.getByText('Evidence coverage')).toBeVisible();

    // The four dimensions with their scores and coverage.
    for (const dimension of [
      'Documentation',
      'Repository metadata',
      'Maintenance',
      'Project structure',
    ]) {
      const row = panel.locator('summary').filter({ hasText: dimension });
      await expect(row).toBeVisible();
      await expect(row).toContainText(/\d+\s*cov 100%/);
    }

    // A dimension opens to its checks, each with a status tag and points.
    await panel.locator('summary').filter({ hasText: 'Documentation' }).click();
    await expect(panel.getByText('Installation instructions', { exact: true })).toBeVisible();
    await expect(panel.getByText('verified', { exact: true }).first()).toBeVisible();

    // The project type comes from rules (a verified signal), not from the model.
    const projectType = panel
      .getByText('Project type', { exact: true })
      .first()
      .locator('xpath=..');
    await expect(projectType.getByText('Application', { exact: true })).toBeVisible();
    await expect(projectType.getByText('rule', { exact: true })).toBeVisible();

    // The Laya block labels every prediction as a model prediction, with its probability.
    const laya = panel.getByText('Laya assessment', { exact: true }).locator('xpath=..');
    await expect(laya.getByText('ok', { exact: true })).toBeVisible();
    await expect(laya.getByText('checkpoint: english')).toBeVisible();
    await expect(laya.getByText('model', { exact: true }).first()).toBeVisible();
    await expect(laya.getByText('README explains the project and how to start')).toBeVisible();
    await expect(laya.getByText(/p=0\.93 · threshold 0\.80/).first()).toBeVisible();
    await expect(laya.getByText(/never treated as a verified fact/)).toBeVisible();

    await expect(panel.getByText(/Fetched .* · (live|cached)/)).toBeVisible();
    expect(page.errors).toEqual([]);
  });

  test('a sparse repository is scored low and a hidden analysis can be reopened', async ({
    page,
  }) => {
    await openProfile(page, 'bob', 'bob');
    const repositories = section(page, 'Repositories');

    await repositories.getByRole('button', { name: 'Analyze: etl-scripts' }).click();
    const panel = repositories.getByRole('region', { name: 'Analysis of etl-scripts' });
    await expect(panel.getByText('Needs improvement', { exact: true })).toBeVisible();
    // Short README: the mock model answers "not sufficient", which is shown as a prediction.
    await expect(panel.getByText('model', { exact: true }).first()).toBeVisible();

    const toggle = repositories.getByRole('button', { name: 'Hide analysis: etl-scripts' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect(panel).toHaveCount(0);
    await repositories.getByRole('button', { name: 'View analysis: etl-scripts' }).click();
    await expect(panel).toBeVisible();
  });

  test('"Analyze top 5" analyzes the five most recently pushed repositories', async ({ page }) => {
    await openProfile(page, 'alice', 'Alice Navarro');
    const repositories = section(page, 'Repositories');

    await repositories.getByRole('button', { name: 'Analyze top 5' }).click();
    await expect(repositories.getByText('5 of 5 analyzed').first()).toBeVisible();

    // Forks are never part of it; the fork row says so.
    const top = ['web-dashboard', 'gateway-api', 'design-tokens', 'infra-playbooks', 'cli-notes'];
    for (const name of top) {
      const row = repositories.getByRole('listitem').filter({ hasText: name }).first();
      await expect(row).toContainText(/\d+\/100 · (Excellent|Good|Needs improvement)/);
    }
    await choose(repositories, 'Forks');
    await expect(
      repositories.getByRole('listitem').filter({ hasText: 'awesome-go-fork' }),
    ).toContainText('forks are not scored');
    await choose(repositories, 'Own');
    // Repositories beyond the top five were not touched.
    await expect(
      repositories.getByRole('button', { name: 'Analyze: legacy-scripts' }),
    ).toBeEnabled();
  });
});
