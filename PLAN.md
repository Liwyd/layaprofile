# LayaProfile Development Plan

## 1. Project Status
- Stage: Implementation
- Current milestone: M2 — GitHub server layer
- Overall completion estimate: ~15%
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
- The contribution calendar is shown only when a token is configured (GraphQL). It is never fabricated.
- Trade-off: no persistence across restarts. That is acceptable, so there is no database or Redis.
- Status: pending (M2).

**D3 — Pure, unit-tested domain modules (`lib/analysis/`).**
- Every score returns `{score|null, label, coverage, components[{id, points, max, status: verified|rule|model|unknown, evidence}]}`.
- Unknown data is excluded from the denominator, never counted as zero. Popularity is excluded from quality.
- Repo weights: documentation 35, metadata 20, maintenance 25, structure 20, renormalized over measurable components.
- Labels: ≥80 Excellent, ≥60 Good, <60 Needs improvement. Coverage <50% → Insufficient evidence.
- Formulas live in `docs/SCORING.md`.
- Status: pending (M3).

**D4 — Laya runs as a sidecar using the official `laya-serve` (PyPI `laya[serve]==0.5.0`).**
- Rejected alternatives:
  - `laya-ts` is not on npm, needs an ONNX export, and is ESM only.
  - The 0.8B vega reader needs ~8 GB RAM.
- Model settings: English encoder checkpoint, preloaded, with `LAYA_MAX_LOADED=1`. The multilingual checkpoint loads lazily for non-Latin READMEs.
- Storage: weights stay in the `laya-hf-cache` volume, never in the image. `HF_HUB_OFFLINE=1` after the first download.
- The app calls `POST /v1/systemone/batch` with a timeout, schema validation and a circuit breaker. It caches results by (repo, pushed_at, model).
- Abstained or non-`auto` routes are treated as "uncertain".
- Laya output only adjusts the documentation sub-assessment and is labelled as a model prediction.
- Status: `laya/Dockerfile` written. Image build and resource measurement are unverified.

**D5 — Security headers in `next.config.js`.**
- Production CSP `script-src 'self'`, `frame-ancestors 'none'`, nosniff, referrer policy, no `X-Powered-By`.
- `postcss` is overridden to ^8.5.33 (Next 15 pins a vulnerable 8.4.31).
- Status: done (M1).

## 3. Implementation Roadmap
Each milestone is implemented in one focused change, verified (`npm run lint && npm test && npm run build`), committed and pushed.

- **M1 Foundation** — done.
- **M2 GitHub server layer**
  - Build `lib/github` (client, cache, validation, errors, rate limiter).
  - Add `/api/profile/[user]`, `/api/repos/[user]/[repo]/analysis` (deterministic part) and `/api/health`.
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
M2 — GitHub server layer (see roadmap acceptance criteria).

## 5. Completed Work Summary
**M1 Foundation.**
- Migrated to Next 15 (Pages Router), React 18, styled-components 6, chart.js 4 and Node 22, with behaviour parity for search, profile, charts, repo sorting and errors.
- Moved `static/` to `public/`. `/user?id=` redirects to `/user/[id]`.
- Replaced octicons, flip-move and gh-polyglot with local code.
- Set up ESLint 9 flat config, Prettier 3 and Vitest (61 tests: `lib/validation`, `lib/languageStats`).
- Removed the fake `utils/scoring.js` and `utils/layaAdapter.js` stubs, plus `now.json` and `yarn.lock`.
- Added security headers. `npm audit` reports 0 vulnerabilities.

## 6. Known Issues and Technical Debt
- **GitHub requests are still made from the browser.**
  - Impact: unauthenticated limit of 60 requests/hour per visitor IP, and no caching.
  - Evidence: `pages/user/[id].js`.
  - Blocks release: yes.
  - Resolution: M2.
- **`docker-compose.yml`, `Dockerfile` and `.github/workflows/ci.yml` from the original commit are broken** (Node 14, missing repo name in the image tag, deprecated actions).
  - Blocks release: yes.
  - Resolution: M7.

## 7. Next Actions
1. M2: `lib/github` client, cache and errors with tests.
2. M2: API routes and switching the client to them.
3. M3: scoring engine.
