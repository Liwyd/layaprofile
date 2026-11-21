# Testing

LayaProfile has two test layers. Both run in CI; run them locally before every commit.

| Layer | Tool | Command | What it covers | Needs |
|---|---|---|---|---|
| Unit and integration | Vitest | `npm test` | Scoring, analysis, validation, the GitHub and Laya clients (against a mocked `fetch`), the API handlers and the UI helpers. Files named `*.test.js` next to the code. | Node only |
| End to end | Playwright | `npm run test:e2e` | The eight user journeys in a real browser against the production build. Files in `e2e/*.spec.mjs`. | The production build, Chrome or Chromium |

`vitest.config.mjs` excludes `e2e/`, so `npm test` never loads a Playwright spec. ESLint
(`npm run lint`) and Prettier (`npx prettier --check .`) cover both layers.

## Unit tests

```sh
npm test            # once
npm run test:watch  # watch mode
```

## End-to-end tests

```sh
npm run test:e2e                         # everything
npx playwright test e2e/04-compare.spec.mjs   # one file
npx playwright test --project=mobile     # only the journeys tagged @mobile
npx playwright test --headed --debug     # watch and step through
npx playwright show-report               # open the HTML report (CI writes one)
```

`npm run test:e2e` first runs `e2e/ensure-build.mjs`, which builds the application (`npm run build`)
only when `.next/BUILD_ID` is missing or an application source file is newer than it. Edited tests
never trigger a build. After changing app code, `npm run test:e2e` therefore rebuilds by itself.

### How a run works

`playwright.config.mjs` starts two servers and waits for both to be ready:

1. **The mock server** (`e2e/mock-server.mjs`, port 3126), a dependency-free Node `http` server that
   stands in for GitHub and Laya. Nothing in the suite touches the network or needs a model.
   - GitHub REST fixtures from `e2e/fixtures`: `alice` (well documented, nine repositories served in
     two pages), `bob` (sparse profile), `ratelimited` (HTTP 403, quota exhausted, reset at 10:30
     UTC) and every other name (404, such as `ghost404`). Every response carries rate-limit headers.
   - A Laya server with the `laya-serve` response shapes. Answers are derived from the request: short
     READMEs get "not sufficient" and "minimal", long ones the opposite, and archetypes come from
     `e2e/fixtures/laya.json`.
   - `POST /__control` with `{ "laya": "ok" | "fail" | "down" }` switches Laya: `fail` answers HTTP
     500, `down` closes every connection. `GET /__stats` counts the requests that reached it.
   - Dates in the fixtures such as `"~12d"` mean "12 days before the server started", so
     recency-based scores do not drift as the calendar moves.
2. **The app**, started as the Docker image starts it: `node .next/standalone/server.js`.
   `e2e/prepare-standalone.mjs` first copies `.next/static` and `public` into `.next/standalone`,
   because `output: 'standalone'` does not (and `next start` does not support that output). The app
   gets `GITHUB_API_BASE` and `LAYA_URL` pointing at the mock server, no `GITHUB_TOKEN`, and
   `TRUST_PROXY=1` so each test can present its own client address (`X-Forwarded-For`) and never
   trips the app's per-client request limit. A dedicated test covers that limit.

Ports are 3125 (app) and 3126 (mock); override them with `E2E_APP_PORT` and `E2E_MOCK_PORT`. Both
servers are always started fresh (`reuseExistingServer: false`) and stopped when the run ends.

### Browsers

CI installs Playwright's Chromium (`npx playwright install --with-deps chromium`). Locally the
installed Google Chrome is used (`channel: 'chrome'`), so no browser is downloaded. Use
`PW_CHANNEL=msedge` for another installed browser, or `PW_CHANNEL=` (empty) to use Playwright's
bundled Chromium after `npx playwright install chromium`.

There are two projects: `chromium` (desktop, every test) and `mobile` (Pixel 5, only tests tagged
`@mobile`). One worker runs the tests one after another in file order, because the specs share the
app's in-process caches and one globally switched Laya mock.

### The journeys

| File | Journey |
|---|---|
| `01-search` | Search from the home page; invalid input; skip link and keyboard submission |
| `02-profile` | Overview numbers, languages, year chart and its table, profile quality and its checks |
| `03-repositories` | Analyze one repository (dimensions, project type, Laya block); "Analyze top 5" |
| `04-compare` | Compare two developers from the home form; popularity grouped; differences, no winner; stacked layout on mobile |
| `05-skills` | Skill categories and strength; technology evidence by repository |
| `06-learning` | Choose a role, then another; the steps change |
| `07-laya-failure` | Laya returning HTTP 500, or unreachable: deterministic scores remain and Laya is reported unavailable; recovery |
| `08-github-errors` | GitHub rate limit, missing users, a comparison naming the missing side, the app's own request limit |

### Writing tests

- Use accessible locators (`getByRole`, `getByLabel`, `getByText`) and assert on content, not CSS.
- The app caches GitHub data and finished Laya assessments in memory for the whole run. A test that
  needs a *fresh* analysis (as the Laya failure tests do) uses a repository no earlier test analyzed
  successfully. Failed Laya assessments are never cached; successful ones are. Add a fixture
  repository rather than a cache-busting hook in the application.
- Laya's circuit breaker opens after three consecutive failures. A test that makes Laya fail must
  reset it to `ok` in `afterEach` (see `07-laya-failure.spec.mjs`).
- Fixtures live in `e2e/fixtures` (JSON, plus `readmes/<owner>--<repo>.md`). Keep them small and
  realistic.

### Failures in CI

The `e2e` job uploads `playwright-report/` and `test-results/` (traces of retried tests and
an error context for each failure) as the `playwright-report` artifact. Open the
trace with `npx playwright show-trace <trace.zip>`.
