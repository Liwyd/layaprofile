// Journey 8: GitHub rate limits and missing users, on the profile and on the comparison page.

import { alert, expect, test } from './support.mjs';

test.describe('GitHub rate limit', () => {
  test('a rate-limited profile shows the limit state with its reset time', async ({ page }) => {
    await page.goto('/user/ratelimited');

    const banner = alert(page);
    await expect(banner.getByRole('heading', { level: 1 })).toHaveText('Request limit reached');
    await expect(banner).toContainText('429 — Rate limited');
    // The mock resets the quota at 10:30 UTC, and the browser runs in UTC.
    await expect(banner).toContainText(/It resets at 10:30\sAM\./);
    await expect(banner.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(banner.getByRole('link', { name: 'Search another profile' })).toBeVisible();
    // It is not reported as a missing user.
    await expect(page.getByText('User not found')).toHaveCount(0);

    // Trying again while the limit still holds keeps the same, explained state.
    await banner.getByRole('button', { name: 'Try again' }).click();
    await expect(banner.getByRole('heading', { level: 1 })).toHaveText('Request limit reached');
    expect(page.errors).toEqual([]);
  });

  test('a rate-limited comparison shows the limit state', async ({ page }) => {
    await page.goto('/compare/alice/ratelimited');
    const banner = alert(page);
    await expect(banner.getByRole('heading', { level: 1 })).toHaveText('Request limit reached');
    await expect(banner).toContainText(/It resets at 10:30\sAM\./);
  });
});

test.describe('missing users', () => {
  test('an unknown profile is reported as not found, with a way back', async ({ page }) => {
    await page.goto('/user/ghost404');

    const banner = alert(page);
    await expect(banner.getByRole('heading', { level: 1 })).toHaveText('User not found');
    await expect(banner).toContainText('GitHub has no public user named "ghost404".');
    // Retrying cannot help, so there is no Try again button.
    await expect(banner.getByRole('button', { name: 'Try again' })).toHaveCount(0);

    await banner.getByRole('link', { name: 'Search another profile' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel('GitHub username')).toBeVisible();
  });

  test('a comparison names the missing side', async ({ page }) => {
    await page.goto('/compare/alice/ghost404');
    const banner = alert(page);
    await expect(banner.getByRole('heading', { level: 1 })).toHaveText('User not found');
    await expect(banner).toContainText(
      'GitHub has no public user named "ghost404" (the second username).',
    );
    // The form to correct the pair is there, with the names filled in.
    await expect(banner.getByLabel('First username')).toHaveValue('alice');
    await expect(banner.getByLabel('Second username')).toHaveValue('ghost404');

    await page.goto('/compare/ghost404/bob');
    await expect(alert(page)).toContainText(
      'GitHub has no public user named "ghost404" (the first username).',
    );
  });

  test('an invalid username is rejected without asking GitHub', async ({ page }) => {
    const response = await page.goto('/user/-bad-name-');
    expect(response.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Not a GitHub username');
  });
});

test.describe("the app's own request limit", () => {
  test('a client that sends too many requests is told to slow down, others are not', async ({
    request,
  }) => {
    const statuses = [];
    let limited;
    for (let count = 0; count < 45; count += 1) {
      const response = await request.get('/api/profile/alice', {
        headers: { 'X-Forwarded-For': '10.200.0.1' },
      });
      statuses.push(response.status());
      if (response.status() === 429) {
        limited = response;
        break;
      }
    }
    expect(statuses).toContain(429);
    expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0);
    expect((await limited.json()).error.code).toBe('RATE_LIMITED');

    // The limit belongs to one client address (the app trusts X-Forwarded-For in this setup).
    const other = await request.get('/api/profile/alice', {
      headers: { 'X-Forwarded-For': '10.200.0.2' },
    });
    expect(other.status()).toBe(200);
  });
});
