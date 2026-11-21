# LayaProfile Development Plan

## 1. Project Status
- Stage: Implementation
- Current milestone: Release verification (owner access needed)
- Overall completion estimate: ~95%. All mandatory features are implemented; Docker and CI publishing are unverified.
- Last verified commit: M1 foundation commit (see git log)
- Blocking issues: none for code work. Docker access from the agent shell is denied (socket permission). This blocks Laya measurement (M4) and Docker validation (M7) until it is resolved.

### Host constraints (dev machine)
2 CPU cores, ~5.7 GB RAM (often <2 GB free), no GPU. Run only one memory-heavy job at a time (Docker build, model load, `next build`). Always cap container memory. A previous session froze the host by running a Laya model load in parallel with an npm build.

## 2. Architecture Decisions

**D1 — Keep the Next.js Pages Router, upgraded to Next 15 / React 18 / styled-components 6 / chart.js 4 / Node 22.**
- Reason: Next 9 required EOL Node 14 and had known CVEs. API routes and `output: 'standalone'` are needed.
- Trade-off: a large one-time migration, but existing components and charts were kept, not rewritten.
- Status: done (M1).

**D2 — GitHub calls move server-side (`lib/github/`, API routes).**
- REST API with an optional server-only `GITHUB_TOKEN`.
- Strict username and repo validation.
- Pagination capped at 300 repos.
- Bounded in-memory LRU+TTL cache that uses ETag, with `fetchedAt`/`cached`/`stale` flags on responses.
- Typed rate-limit errors, and a per-IP token bucket on our own routes.
- READMEs are fetched only for analyzed repos, with a size cap. Repository trees are top level only.
- No contribution calendar or commit history: it would need GraphQL with a token. Activity is shown as repository creation and last-push years, labelled as such. Nothing is fabricated.
- Trade-off: no persistence across restarts. That is acceptable, so there is no database or Redis.
- Status: done (M2). Deviations: the stale fallback also covers rate limits and other non-404 upstream errors. Pagination builds `&page=N` itself and does not follow `Link` URLs. Confirmed-absent README/tree/release are cached as `null`. Singletons live on `globalThis`.

**D3 — Pure, unit-tested domain modules (`lib/analysis/`).**
- Every score returns `{score|null, label, coverage, components[{id, points, max, status: verified|rule|model|unknown, evidence}]}`.
- Unknown data is excluded from the denominator, never counted as zero. Popularity is excluded from quality.
- Repo weights: documentation 35, metadata 20, maintenance 25, structure 20, renormalized over measurable components.
- Labels: ≥80 Excellent, ≥60 Good, <60 Needs improvement. Coverage <50% → Insufficient evidence.
- Formulas live in `docs/SCORING.md`.
- A dimension with coverage < 0.4 has a null score (prevents one surviving check from standing in for a dimension).
- Keyword checks are unknown, not 0, for truncated or non-Latin/Persian READMEs.
- Status: done (M3).

**D4 — Laya runs as a sidecar using the official `laya-serve` (PyPI `laya[serve]==0.5.0`).**
- Rejected alternatives:
  - `laya-ts` is not on npm, needs an ONNX export, and is ESM only.
  - The 0.8B vega reader needs ~8 GB RAM.
- Model settings: English encoder checkpoint, preloaded, with `LAYA_MAX_LOADED=1`. The multilingual checkpoint loads lazily for non-Latin READMEs.
- Storage: weights stay in the `laya-hf-cache` volume, never in the image. `HF_HUB_OFFLINE=1` after the first download.
- The app calls `POST /v1/systemone/batch` with a timeout, schema validation and a circuit breaker. It caches results by (repo, pushed_at, model).
- Abstained or non-`auto` routes are treated as "uncertain".
- Laya output only adjusts the documentation sub-assessment and is labelled as a model prediction.
- Status: code done (M4).
  - `lib/laya`: client with gating, circuit breaker, result cache and a question catalog (yes/no questions use A/B `choice` to avoid the `noul` label bias).
  - `applyLayaAssessment` adds a `model` check to documentation. It is absent when Laya is disabled and unknown when Laya is uncertain or unavailable.
  - NOT YET VERIFIED: the image build, real inference, RAM/latency measurements, threshold eval (`scripts/eval-laya.mjs`) and whether the HTTP route accepts the per-bucket `min_confidence` map (the client falls back to a scalar).

**D5 — Security headers in `next.config.js`.**
- Production CSP `script-src 'self'`, `frame-ancestors 'none'`, nosniff, referrer policy, no `X-Powered-By`.
- `postcss` is overridden to ^8.5.33 (Next 15 pins a vulnerable 8.4.31).
- Status: done (M1).

## 3. Implementation Roadmap
Each milestone is implemented in one focused change, verified (`npm run lint && npm test && npm run build`), committed and pushed.

- **M1 Foundation** — done.
- **M2 GitHub server layer**
  - Build `lib/github` (client, cache, validation, errors, rate limiter).
  - Add `/api/profile/[user]`, `/api/repos/[user]/[repo]/evidence` (raw evidence; scoring is added in M3) and `/api/health`.
  - Switch the client off direct GitHub calls.
  - Acceptance: unit and integration tests run against a mocked fetch and cover pagination, 404, rate limit, network error, cache hit, ETag 304 and invalid input. The profile page renders through our API.
- **M3 Scoring engine**
  - Profile score, repo score, README checks, structure checks, maintenance and archetype, plus `docs/SCORING.md`.
  - Acceptance: tests cover boundaries, missing data, no zero-for-unknown, and popularity-independence.
- **M4 Laya integration**
  - `lib/laya` (client, question catalog, fallback).
  - Eval fixtures `eval/labels.jsonl` (~30, including Persian) and `scripts/eval-laya.mjs`, with results in `docs/LAYA.md`.
  - Measure cold/warm latency and RAM one job at a time, memory-capped.
  - Acceptance: tests cover unavailable, invalid-response and abstain cases. The app works with Laya down.
- **M5 Skills, learning path, comparison**
  - `skills`, `learningPath` (transparent ruleset per role) and `compare` modules.
  - `/api/compare`.
  - Tests.
- **M6 UI**
  - Editorial design system.
  - `/user/[id]` report sections: overview, stats, profile score and checklist, repos with quality drawer, skill evidence, learning path, share card.
  - `/compare/[a]/[b]` difference view.
  - Designed loading, empty, partial and error states. Responsive, keyboard accessible, reduced motion.
- **M7 Docker + CI/CD**
  - App image: multi-stage, standalone, non-root, healthcheck.
  - Compose with published images, a volume and memory limits, plus `.env.example`.
  - CI order: lint → test → build → e2e → docker build, then push to Docker Hub with `latest`, `sha-*`, semver and branch tags and a concurrency group.
  - `scripts/deploy.sh`.
- **M8 E2E**
  - Playwright journeys 1–8 against a local fixture mock server.
- **M9 Docs**
  - README (keeping OctoProfile attribution and its MIT notice), `docs/DEPLOYMENT.md`, final PLAN.
- **M10 SRS**
  - Persian SRS from the `~/Downloads/SRS` template, filled in for LayaProfile, in `docs/srs/`, compiled to PDF.

## 4. Current Task
Release verification. It is blocked on owner access.
1. Push the commits. The current credential (`thugbit`) gets a 403.
2. Docker access for the agent, or the owner runs it:
   - `docker compose -f docker-compose.yml -f docker-compose.build.yml up --build`
   - check `/api/health`
   - measure Laya RAM and latency
   - run `scripts/eval-laya.mjs`, then set the thresholds in `docs/LAYA.md`
3. Confirm the first CI run publishes the images. GitHub Actions billing must be enabled.
4. Compile the SRS with XeLaTeX (no TeX toolchain on this host).

## 5. Completed Work Summary
**M1 Foundation.**
- Migrated to Next 15 (Pages Router), React 18, styled-components 6, chart.js 4 and Node 22, with behaviour parity for search, profile, charts, repo sorting and errors.
- Moved `static/` to `public/`. `/user?id=` redirects to `/user/[id]`.
- Replaced octicons, flip-move and gh-polyglot with local code.
- Set up ESLint 9 flat config, Prettier 3 and Vitest (61 tests: `lib/validation`, `lib/languageStats`).
- Removed the fake `utils/scoring.js` and `utils/layaAdapter.js` stubs, plus `now.json` and `yarn.lock`.
- Added security headers. `npm audit` reports 0 vulnerabilities.

**M2 GitHub server layer.**
- `lib/github` (client, LRU+TTL+ETag cache, typed errors, token bucket, profile and repo-evidence loaders) and `lib/api/handler.js`.
- Routes: `/api/profile/[user]`, `/api/repos/[user]/[repo]/evidence`, `/api/health`.
- The browser now calls only our API; CSP is `connect-src 'self'`.
- Stale and truncated notices.
- 224 tests.

**M3 Scoring engine.**
- `lib/analysis` modules: labels, readmeChecks, structureChecks, repoScore, profileScore, archetype, plus shared helpers.
- `/api/repos/[user]/[repo]/analysis` route.
- The profile API includes `profileReadme` and `profileScore`.
- `docs/SCORING.md`.
- 420 tests, including popularity-invariance and missing-data boundaries.

**M4 Laya integration (code).**
- `lib/laya` (questions, state, client, assess, assessCache) and `lib/analysis/layaAssessment.js`.
- The analysis route returns `laya`, and `/api/health` reports Laya status.
- `eval/labels.jsonl` (30 developer-labelled fixtures, including Persian and injection cases), `scripts/eval-laya.mjs` and `docs/LAYA.md`.
- 588 tests.

**M5 Skills, learning path, comparison.**
- `lib/analysis` technologies (56-entry table), skills, learningPath (6 roles, no external links) and compare (no winner or ranking; popularity rows flagged).
- Routes: `/api/compare?a&b`, `/api/learning-path/[user]?role`; the profile API includes `skills`.
- `docs/SKILLS.md`.
- 750 tests.
- Laya `skill_category` is wired in the model but not yet asked by any route.

**M6a Design system and report.**
- Editorial design system via CSS variables, with automatic dark mode.
- Home page with search and a compare form.
- `/user/[id]` report with six numbered sections: on-demand repo analysis plus "Analyze top 5" (at most 2 concurrent), skill evidence explorer, role-based learning path, and sticky section nav.
- Old OctoProfile components removed; attribution kept in the footer.
- `lib/ui` helpers tested; 825 tests.
- Checked in headless Chrome at 1280/390 px, light and dark.

**M6b Compare page and share card.**
- `/compare/[a]/[b]` difference view: neutral paired bars, popularity grouped separately, stacked layout on mobile, error naming the missing side.
- Canvas share card with PNG download.
- LayaProfile OG image, favicon.ico and apple-touch icon.
- GitHub errors are recognised by brand rather than `instanceof` (fixes 500s in `next dev`).
- 901 tests.

**M7 Docker and CI/CD.**
- App image: alpine, multi-stage, standalone, non-root, node-fetch healthcheck.
- Laya sidecar image with no weights and an HF cache volume.
- `docker-compose.yml` uses published images only, with Laya enabled through `COMPOSE_PROFILES=laya` and memory limits; `docker-compose.build.yml` is for local builds.
- CI: verify job, then a docker matrix with a smoke test, then a push on non-PR runs. Tags are `latest` (default branch only), `sha-*`, semver and branch, with publish concurrency groups.
- `scripts/deploy.sh` (pull, up, wait for health; never rebuilds) and `docs/DEPLOYMENT.md`.
- Validated with actionlint, hadolint, shellcheck, `compose config` and a simulated runtime layout.
- NOT yet validated: real `docker build` / `docker run` and a real CI run.

**M8 E2E.**
- Playwright (`@playwright/test` 1.65.1) against the standalone server and a dependency-free GitHub+Laya mock server (`e2e/mock-server.mjs`, with Laya ok/fail/down control).
- 27 tests covering journeys 1–8, keyboard checks, and a mobile subset.
- CI `e2e` job gates the docker publish.
- `docs/TESTING.md`.

**M9 Documentation.**
- README rewritten: features, principles, architecture, quick starts, config, API, testing, docs index, limitations and credits.
- Docs checked against the code.
- The bundled SF Mono (Apple license, not redistributable) is removed. Monospace now uses the system font stack.
- Inter OFL license added.
- `og.png` regenerated.

**M10 Persian SRS.**
- `docs/srs/main.tex`, built from the template: BRD + SRS, 52 FRs, 47 NFRs, traceability to files and tests, unmeasured targets marked as such.
- Structure checked by script.
- Not compiled (no TeX here).
- The template font is kept out of git (license unverified).

## 6. Known Issues and Technical Debt
- **`npm start` warns that `next start` is unsupported with `output: standalone`.**
  - It still serves.
  - Resolution: M7 runs `node .next/standalone/server.js` in Docker.
- **Laya is unmeasured.**
  - Impact: thresholds are provisional, and RAM fit on a 5.7 GB host is unknown.
  - Evidence: `docs/LAYA.md` "NOT YET MEASURED".
  - Blocks release: no; the app degrades to deterministic mode.
  - Resolution: needs Docker access in the agent shell (currently permission denied).
- **Not implemented (non-blocking limitations):**
  - contribution calendar and commit history (needs GraphQL and a token);
  - manifest/file evidence in the profile-level skill map (the modules support it, but no route feeds repo analyses);
  - Laya `skill_category` is not asked by any route.
  - All of these are documented in the README.
- **Docker images never built for real.**
  - Impact: the Dockerfiles are validated statically only.
  - Evidence: the agent shell gets "permission denied" on the docker socket.
  - Blocks release: yes (project completion requires a working Docker deployment).
  - Resolution: build once Docker access is granted, or let CI build after a push.
- **Push blocked.**
  - Evidence: `git push` returns 403 for user `thugbit` on `Liwyd/layaprofile`.
  - Blocks release: yes (the CI publish needs the commits on GitHub).
  - Resolution: owner credentials.

## 7. Next Actions
1. Owner: grant push access and Docker access.
2. Compile the SRS.
3. Real `docker build`, compose up, Laya measurement and the eval (`scripts/eval-laya.mjs`); then update docs/LAYA.md and the thresholds.
