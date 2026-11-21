// End-to-end tests (see docs/TESTING.md). They run against the production build exactly as the
// Docker image starts it (`node .next/standalone/server.js`), with GitHub and Laya replaced by
// the local mock server in e2e/mock-server.mjs. Nothing here needs the network or a model.

import { defineConfig, devices } from '@playwright/test';
import { APP_PORT, APP_URL, HOST, MOCK_PORT, MOCK_URL } from './e2e/env.mjs';

const isCI = Boolean(process.env.CI);

// CI installs Playwright's own Chromium. Locally the installed Google Chrome is used so no
// browser has to be downloaded; set PW_CHANNEL to another channel (or to an empty string to use
// Playwright's bundled Chromium).
const channel = process.env.PW_CHANNEL ?? (isCI ? undefined : 'chrome');

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.mjs',
  // The specs share one app server (and its in-process caches) and one mock server whose Laya
  // behaviour is switched globally, so they run one after another, in file order.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: APP_URL,
    channel: channel || undefined,
    // A fixed zone and locale make the rendered times (the rate-limit reset) assertable.
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      // Only the journeys tagged @mobile run on a phone viewport.
      grep: /@mobile/,
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: [
    {
      name: 'mock',
      command: 'node e2e/mock-server.mjs',
      url: `${MOCK_URL}/__health`,
      reuseExistingServer: false,
      env: { E2E_MOCK_PORT: String(MOCK_PORT) },
    },
    {
      name: 'app',
      command: 'node e2e/prepare-standalone.mjs && node .next/standalone/server.js',
      url: `${APP_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'production',
        PORT: String(APP_PORT),
        HOSTNAME: HOST,
        GITHUB_API_BASE: MOCK_URL,
        LAYA_URL: MOCK_URL,
        // Anything inherited from the developer's shell must not reach the app under test.
        GITHUB_TOKEN: '',
        LAYA_API_KEY: '',
        // Every test sends its own X-Forwarded-For (see e2e/support.mjs), so the app's per-client
        // request limit never throttles the suite.
        TRUST_PROXY: '1',
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
});
