// Journey 6: the personalized learning path.

import { choose, expect, openProfile, section, test } from './support.mjs';

const stepTitles = learning => learning.getByRole('heading', { level: 3 }).allTextContents();

test.describe('learning path', () => {
  test('choosing a role shows its steps, and another role shows different ones', async ({
    page,
  }) => {
    await openProfile(page, 'alice', 'Alice Navarro');
    const learning = section(page, 'Learning path');

    // Nothing is requested until a role is chosen.
    await expect(learning.getByText(/Choose a target role/)).toBeVisible();
    await expect(learning.getByRole('heading', { level: 3 })).toHaveCount(0);

    await choose(learning, 'Backend developer');
    await expect(learning.getByText('Evidence for Backend developer')).toBeVisible();
    await expect(
      learning.getByRole('heading', {
        level: 3,
        name: 'Gain hands-on experience with an HTTP framework',
      }),
    ).toBeVisible();
    await expect(
      learning.getByRole('heading', {
        level: 3,
        name: 'Build a small REST API backed by a relational database',
      }),
    ).toBeVisible();
    await expect(learning.getByText('Priority 1')).toBeVisible();
    await expect(learning.getByText('strong evidence').first()).toBeVisible();
    // Steps the evidence cannot support say so, and no course or link is invented.
    await expect(learning.getByText('no evidence').first()).toBeVisible();
    await expect(learning.getByText(/based on:/).first()).toBeVisible();
    const backend = await stepTitles(learning);

    await choose(learning, 'Frontend developer');
    await expect(learning.getByText('Evidence for Frontend developer')).toBeVisible();
    await expect(learning.getByText('Evidence for Backend developer')).toHaveCount(0);
    await expect(
      learning.getByRole('heading', {
        level: 3,
        name: 'Gain hands-on experience with an HTTP framework',
      }),
    ).toHaveCount(0);
    const frontend = await stepTitles(learning);

    expect(frontend.length).toBeGreaterThan(0);
    expect(frontend).not.toEqual(backend);
    expect(page.errors).toEqual([]);
  });
});
