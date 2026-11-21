// Journey 7: Laya is optional. When inference fails or the server is unreachable, the analysis
// still renders every deterministic score, the Laya block says so in plain words, and nothing
// else on the page is affected.
//
// The app caches finished Laya assessments per repository. Each test here analyzes a repository
// that no earlier test analyzed with a working Laya (legacy-scripts, old-notes, etl-scripts are
// outside the "top 5" and outside the other journeys), so the failure cannot be masked by the cache.
// The mock request counter proves that the request really reached the failing server.

import { alert, expect, mockStats, openProfile, section, setLaya, test } from './support.mjs';

test.describe('Laya failures', () => {
  test.afterEach(async ({ request }) => {
    await setLaya(request, 'ok');
  });

  const analyze = async (page, repo) => {
    const repositories = section(page, 'Repositories');
    await repositories.getByRole('button', { name: `Analyze: ${repo}` }).click();
    return repositories.getByRole('region', { name: `Analysis of ${repo}` });
  };

  // The deterministic part of an analysis, which must be intact whatever Laya does.
  const expectDeterministicAnalysis = async panel => {
    await expect(panel.getByText('/100')).toBeVisible();
    await expect(panel.getByText('Needs improvement', { exact: true })).toBeVisible();
    for (const dimension of [
      'Documentation',
      'Repository metadata',
      'Maintenance',
      'Project structure',
    ]) {
      await expect(panel.locator('summary').filter({ hasText: dimension })).toContainText(/\d+/);
    }
    await expect(panel.getByText('Recommendations')).toBeVisible();
  };

  test('failed inference: deterministic scores remain and Laya is reported unavailable', async ({
    page,
    request,
  }) => {
    await setLaya(request, 'fail');
    const before = await mockStats(request);
    await openProfile(page, 'alice', 'Alice Navarro');

    const panel = await analyze(page, 'legacy-scripts');
    await expectDeterministicAnalysis(panel);

    const laya = panel.getByText('Laya assessment', { exact: true }).locator('xpath=..');
    await expect(laya.getByText('unavailable', { exact: true })).toBeVisible();
    await expect(
      laya.getByText(
        'The local Laya server could not be reached or failed. The score uses deterministic rules only.',
      ),
    ).toBeVisible();
    await expect(laya.getByText('The Laya server failed (HTTP 500).')).toBeVisible();
    // No prediction is shown, and nothing is presented as a negative result.
    await expect(laya.getByText('uncertain:', { exact: false })).toHaveCount(0);
    await expect(laya.getByText('checkpoint:')).toHaveCount(0);

    const after = await mockStats(request);
    expect(after.layaBatch).toBeGreaterThan(before.layaBatch);

    // The rest of the report is unaffected.
    await expect(section(page, 'Skill evidence')).toBeVisible();
    await expect(alert(page)).toHaveCount(0);
    expect(page.errors).toEqual([]);
  });

  test('unreachable Laya server: the analysis still works', async ({ page, request }) => {
    await setLaya(request, 'down');
    await openProfile(page, 'alice', 'Alice Navarro');

    const panel = await analyze(page, 'old-notes');
    await expect(panel.getByText('/100')).toBeVisible();
    await expect(panel.locator('summary').filter({ hasText: 'Maintenance' })).toContainText(/\d+/);

    const laya = panel.getByText('Laya assessment', { exact: true }).locator('xpath=..');
    await expect(laya.getByText('unavailable', { exact: true })).toBeVisible();
    await expect(laya.getByText('Could not reach the Laya server.')).toBeVisible();
    await expect(alert(page)).toHaveCount(0);
    expect(page.errors).toEqual([]);
  });

  test('the health endpoint reports an unreachable Laya server without failing', async ({
    request,
  }) => {
    await setLaya(request, 'down');
    const response = await request.get('/api/health');
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.laya.status).toBe('unavailable');
  });

  test('analysis uses Laya again as soon as it is back', async ({ page, request }) => {
    await setLaya(request, 'ok');
    await openProfile(page, 'bob', 'bob');

    const panel = await analyze(page, 'housing-prices');
    const laya = panel.getByText('Laya assessment', { exact: true }).locator('xpath=..');
    await expect(laya.getByText('ok', { exact: true })).toBeVisible();
    await expect(laya.getByText('checkpoint: english')).toBeVisible();
  });
});
