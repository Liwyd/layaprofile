// Shared test setup: the extended `test`, and helpers for the mock server's control endpoints.

import { test as base, expect } from '@playwright/test';
import { MOCK_URL } from './env.mjs';

export { expect };

// A 1x1 transparent PNG. Avatars normally come from GitHub's CDN; tests never use the network.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

// The app limits requests per client address. Each test is its own "client" through
// X-Forwarded-For (honoured because the app runs with TRUST_PROXY=1), so the number of requests a
// whole run makes never trips the limit, and a test that wants to see the limit would not be
// affected by the others.
let clients = 0;
const nextClientAddress = () => {
  clients += 1;
  return `10.77.${(clients >> 8) & 255}.${clients & 255}`;
};

// (The fixture callback is named `provide`: ESLint reads `use(...)` as a React hook.)
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.context().setExtraHTTPHeaders({ 'X-Forwarded-For': nextClientAddress() });
    await page.route('https://avatars.githubusercontent.com/**', route =>
      route.fulfill({ contentType: 'image/png', body: PIXEL }),
    );
    // Uncaught errors in the page are always a failure; tests assert on `page.errors`.
    page.errors = [];
    page.on('pageerror', error => page.errors.push(error.message));
    await provide(page);
  },
});

/** Sets how the mock Laya server behaves: 'ok', 'fail' (HTTP 500) or 'down' (no answer). */
export const setLaya = async (request, mode) => {
  const response = await request.post(`${MOCK_URL}/__control`, { data: { laya: mode } });
  expect(response.ok(), `setting the mock Laya mode to ${mode}`).toBe(true);
};

/** Request counters of the mock server: { github, layaHealth, layaBatch }. */
export const mockStats = async request => {
  const response = await request.get(`${MOCK_URL}/__stats`);
  expect(response.ok()).toBe(true);
  return response.json();
};

/** Opens a profile report and waits until it has loaded. */
export const openProfile = async (page, login, name) => {
  await page.goto(`/user/${login}`);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
};

/**
 * The alerts that carry a message. Next.js also keeps an empty `role="alert"` route announcer in
 * every page, which a plain `getByRole('alert')` would match too.
 */
export const alert = page => page.getByRole('alert').filter({ hasText: /\S/ });

/** A numbered report section by its title. */
export const section = (page, title) => page.getByRole('region', { name: title, exact: true });

/** The value shown for a label in the overview strip (the `dd` that follows its `dt`). */
export const stat = (page, label) =>
  page
    .getByRole('term')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator('xpath=following-sibling::*[1]');

/**
 * Picks an option of a segmented control (radio inputs whose labels are the visible buttons) by
 * clicking its label, as a visitor would, and checks that it is now selected.
 */
export const choose = async (scope, name) => {
  await scope.getByText(name, { exact: true }).click();
  await expect(scope.getByRole('radio', { name })).toBeChecked();
};
