// Journey 5: the skill evidence explorer.

import { expect, openProfile, section, test } from './support.mjs';

test.describe('skill evidence', () => {
  test('categories show how strong the public evidence is, and technologies list their repositories', async ({
    page,
  }) => {
    await openProfile(page, 'alice', 'Alice Navarro');
    const skills = section(page, 'Skill evidence');

    await expect(skills.getByText(/Activity is not proof of professional expertise/)).toBeVisible();
    await expect(skills.getByText(/Based on 8 own repositories/)).toBeVisible();
    await expect(skills.getByText(/1 forks not counted/)).toBeVisible();

    const category = name =>
      skills
        .getByRole('listitem')
        .filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) });

    // Strength is evidence, never a skill level: observed or weak, in words.
    await expect(category('Backend development')).toContainText('observed');
    await expect(category('Frontend development')).toContainText('observed');
    await expect(category('Systems programming')).toContainText('weak');
    await expect(category('Frontend development')).toContainText('2 repositories');

    // Categories without evidence are listed, and say they are not a verified negative.
    await skills.getByText('No public evidence found (2)').click();
    await expect(skills.getByText('Mobile development')).toBeVisible();
    await expect(skills.getByText('Embedded development')).toBeVisible();
    await expect(skills.getByText(/This is not a verified negative/)).toBeVisible();

    // Opening a technology lists the repositories behind it and the kind of signal.
    const react = skills.getByRole('button', { name: /^React/ });
    await expect(react).toHaveAttribute('aria-expanded', 'false');
    await react.click();
    await expect(react).toHaveAttribute('aria-expanded', 'true');
    const evidence = skills.locator('#evidence-frontend');
    await expect(evidence.getByRole('heading', { level: 4 })).toHaveText(
      'React: observed, 2 repositories',
    );
    await expect(evidence.getByRole('link', { name: 'web-dashboard' })).toBeVisible();
    await expect(evidence.getByRole('link', { name: 'design-tokens' })).toBeVisible();
    await expect(evidence.getByText('topic').first()).toBeVisible();

    // Choosing another technology replaces the list; choosing it again closes it.
    await skills.getByRole('button', { name: /^Docker/ }).click();
    await expect(skills.locator('#evidence-devops-infrastructure')).toContainText(
      'infra-playbooks',
    );
    await react.click();
    await expect(react).toHaveAttribute('aria-expanded', 'false');
    await expect(evidence.getByRole('heading', { level: 4 })).toHaveCount(0);
  });
});
