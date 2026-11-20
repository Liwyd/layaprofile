# LayaProfile scoring

This document describes every score the application computes and matches the code in
`lib/analysis/`. It is **not an industry benchmark**: the scores are a transparent checklist of
conventions that are visible in public GitHub data. A high score does not prove that a project or
a developer is good, and a low score does not prove the opposite.

## Principles

- Every score is reproducible: the same input and the same clock (`now`) give the same output.
- Every check carries the evidence it was based on and, when points are missing, a recommendation.
- Data that is unknown or unavailable is **excluded from the denominator**, never scored as zero,
  and is listed as unknown.
- Popularity (stars, forks, watchers, followers) never affects a score.
- A file or section being found is reported as "found", never as "good". Presence says nothing
  about quality.
- Quality (`score`) and confidence (`coverage`) are reported separately.

## Result shape

| Level | Fields |
|---|---|
| Check | `id`, `label`, `points` (null when unknown), `max`, `status`, `evidence`, `recommendation?` |
| Dimension | `id`, `label`, `weight`, `score` (0-100 or null), `coverage` (0-1), `checks` |
| Assessment | `score` (or null), `label`, `coverage`, `dimensions`, `strengths`, `weaknesses`, `unknowns`, `recommendations`, `notes` |

Check `status`:

| Status | Meaning |
|---|---|
| `verified` | An observed fact (a field GitHub reports, a file name found). |
| `rule` | A deterministic heuristic (keyword and threshold rules). Also used for "not found" results, which are limited to what was inspected. |
| `model` | A Laya prediction. Only `laya-readme-sufficiency` uses it. It is never a verified fact and its evidence always says "prediction". |
| `unknown` | The data is unavailable. `points` is null and the check is excluded from every total. |

## Formulas

- **Dimension score** = round(100 x sum(points) / sum(max)) over the checks that are known.
  It is null when no check is known, or when dimension coverage is below 0.4
  (`MIN_DIMENSION_COVERAGE`): a few surviving checks must not stand in for the whole dimension. Checks with `max` 0 are informational and do not count.
- **Dimension coverage** = sum(max of known checks) / sum(max of all checks).
- **Overall score** = round(sum(weight x dimension score) / sum(weight)) over dimensions that have
  a score. Dimensions without a score are left out and the remaining weights are renormalized.
  The rounded dimension scores are used, so the overall score can be recomputed from what is shown.
- **Overall coverage** = sum(weight x dimension coverage) / sum(weight of all dimensions).
- **Strengths**: known checks at full points. **Weaknesses**: known checks at 50% of `max` or
  less. **Unknowns**: checks with no data. Each item carries `dimensionId` and `checkId`.
- **Recommendation impact** = (max - points) / sum(max of known checks in the dimension)
  x (weight / sum(weight of scored dimensions)) x 100, rounded to one decimal. It is the potential
  gain in overall points if that check reached its maximum. When all dimensions are scored and the
  weights add up to 100 this equals `(max - points) / sum(max) x weight`. Recommendations are
  sorted by impact, then by dimension and check order.

### Labels (`lib/analysis/labels.js`)

| Condition | Label |
|---|---|
| score is null, or coverage < 0.5 | Insufficient evidence |
| score >= 80 | Excellent |
| score >= 60 | Good |
| otherwise | Needs improvement |

## Repository score (`scoreRepository`)

Input: the output of `loadRepoEvidence`. Weights: documentation 35, metadata 20, maintenance 25,
structure 20.

**Forks are not scored** (`score` null, label Insufficient evidence, with a note), because their
content mostly reflects the upstream repository.

### Documentation (35), 18 points plus 2 from the model check

README state: *present*, *absent* (GitHub confirmed there is none) or *unknown* (the request
failed). When the README is unknown, every check that needs it is unknown. When it is absent, the
README checks score 0 as a verified negative.

| Check | Max | Rule |
|---|---:|---|
| `readme` (verified) | 4 | README exists: 4. Absent: 0. |
| `readme-length` | 3 | Words of prose (code blocks, URLs and tags excluded): >= 150: 3; 50-149: 1.5; < 50: 0. |
| `install` | 3 | An install command in a code block: 3. Only an install heading or label: 2. Neither: 0. |
| `usage` | 3 | A usage/examples section with at least one code block beneath it: 3. Section only: 2. None: 0. |
| `readme-structure` | 2 | >= 3 headings: 2; 1-2 headings: 1; none: 0. |
| `configuration` | 1 | A config/environment/options/settings section, or a `.env` mention: 1. |
| `contributing` | 1 | A contributing heading, a link to CONTRIBUTING, or a `CONTRIBUTING*` file at the root: 1. |
| `docs-reference` | 1 | A `docs`/`doc`/`documentation` directory, `mkdocs.yml` or `docusaurus.config.*` at the root, a README heading about API/reference/documentation/docs, or a link to a docs site: 1. |
| `laya-readme-sufficiency` (model) | 2 | Added after the deterministic scoring by `applyLayaAssessment` (`lib/analysis/layaAssessment.js`). A confident Laya prediction that the README explains the purpose and how to get started: 2. A confident prediction that it does not: 0. Otherwise unknown. Not added at all when Laya is disabled by configuration (a deployment choice, not missing evidence). |

#### The model check

The Laya question `readme_sufficient` (see `docs/LAYA.md`) is asked about the cleaned README text.
Its answer enters the score only when it is **confident**, that is when the probability of the
reported answer is at least the question's threshold (0.80, provisional) and the server did not
abstain. The check then has status `model` and evidence such as `Laya model prediction (english
checkpoint, p=0.91): README explains the purpose and how to get started`.

In every other case the check is **unknown** and excluded from every total, so the scores equal the
deterministic scores. The evidence says why:

| Situation | Evidence |
|---|---|
| Uncertain answer | `Laya uncertain (p=0.62 < 0.80); the prediction is not used` (`abstained` instead of `uncertain` when the server abstained) |
| Laya is not configured, or the result was not computed | `Laya is not enabled on this server` |
| The server failed, timed out or sent an invalid response | `Laya unavailable` |
| The repository has no README text to assess | `no README text was available for Laya to assess` |

An unknown model check only lowers coverage: with Laya off, the documentation coverage is 18/20 and
the overall coverage drops by 3.5 points. It never lowers a score. Forks are not scored, so they get
no model check. The model check does not replace the deterministic README checks. The other README
answers of the model (installation clarity, usage examples, documentation completeness) appear in
the `laya` part of the API response as evidence only and never change a score.

Keyword rules (English and Persian):

- Headings: ATX (`#`), underlined (`===`, `---`), HTML `<h1>`-`<h6>` and short standalone label
  lines such as `Installation:`. HTML comments and fenced code are ignored when looking for
  headings, but code blocks are still counted.
- install: install, installation, installing, getting started, setup, quick start; Persian
  نصب, راه‌اندازی.
- usage: usage, example(s), how to use, quick start; Persian استفاده, نمونه, مثال.
- configuration: config, configuration, environment, options, settings, `.env`; Persian پیکربندی,
  تنظیمات, کانفیگ.
- contributing: contribute, contributing, contribution(s); Persian مشارکت ("Contributors" alone does
  not count).
- Install commands in code blocks: `npm i|install|ci`, `yarn add|install`, `pnpm add|i|install`,
  `pip install`, `python -m pip install`, `poetry add|install`, `conda install`,
  `cargo add|install`, `go get|install`, `docker run|pull|compose`, `brew install`,
  `apt install`, `gem install`, `composer require`, `dotnet add`, `git clone`, `make`.
- Sub-headings stay inside the section above them, so code under `## Usage` / `### CLI` counts as usage code.

Where "not found" cannot be trusted, keyword-based checks (`install`, `usage`, `configuration`,
`contributing`, `docs-reference`) are **unknown** instead of 0:

- the README was truncated at 100 KB;
- the README is written mostly in a script the keyword rules do not cover (CJK, Cyrillic, or
  another non-Latin script with at least 20 words). Install commands in code blocks and the
  length/structure checks still work.

`contributing` and `docs-reference` combine two sources (README and file listing). They are unknown
when nothing was found and any source could not be inspected.

### Repository metadata (20), 12 points

All fields come with the repository itself. A field GitHub did not send is unknown.

| Check | Max | Rule |
|---|---:|---|
| `description` | 4 | >= 20 characters: 4; 1-19: 2; none: 0. |
| `topics` | 3 | >= 3 topics: 3; 1-2: 1.5; none: 0. |
| `license` | 4 | Recognized SPDX id: 4. `NOASSERTION` (license file present but not recognized): 2. None detected: 0. |
| `homepage` | 1 | Set: 1. |

### Maintenance (25), 11 points

| Check | Max | Rule |
|---|---:|---|
| `recency` (rule) | 5 | Last push (`pushed_at`) at most 90 days before `now`: 5; <= 365 days: 3; <= 730 days: 1; older: 0. A date in the future counts as recent. |
| `not-archived` | 3 | Not archived: 3. Archived: 0, with a recommendation to say so in the README. Archiving is a deliberate state, and the evidence says so. |
| `releases` | 2 | A published release exists: 2. Confirmed none (drafts and pre-releases are not counted): 0 as a `rule`, noting that not every project needs releases. Unavailable: unknown. |
| `issues-enabled` | 1 | Issues enabled: 1. |

Open issue and pull request counts are **not used**: a high count can mean an active community as
easily as neglect, and a count of zero can mean no users.

### Project structure (20), 10 points

Only the top level of the file listing is inspected (names, case-insensitive). "Not found" means
"not found at the repository root". The whole dimension is unknown when the listing could not be
retrieved or the repository is empty (evidence: "the repository is empty").

| Check | Max | Rule |
|---|---:|---|
| `source-layout` | 3 | Source directory (`src`, `lib`, `app`, `pkg`, `cmd`, `internal`) or top-level source files: 2. A manifest (`package.json`, `pyproject.toml`, `requirements.txt`, `setup.py`, `Cargo.toml`, `go.mod`, `pom.xml`, `build.gradle(.kts)`, `Gemfile`, `composer.json`, `*.csproj`, `CMakeLists.txt`, `Makefile`, `mix.exs`, `pubspec.yaml`, `Package.swift`): 1. |
| `tests` | 3 | A test directory (`test`, `tests`, `__tests__`, `spec`, `e2e`) or test files/configs (`*_test.go`, `test_*.py`, `*.test.*`, `*.spec.*`, `pytest.ini`, `conftest.py`, `jest|vitest|playwright|cypress.config.*`, `phpunit.xml`, `.rspec`): 3. Presence says nothing about test quality. |
| `ci` | 2 | `.gitlab-ci.yml`, `.circleci`, `.travis.yml`, `Jenkinsfile`, `azure-pipelines.yml`, `appveyor.yml`, `.drone.yml`, `bitbucket-pipelines.yml`, `.buildkite`: 2. A `.github` directory alone: 1, shown as "possible CI (.github directory)" because its contents are not inspected. |
| `license-file` | 1 | `LICENSE*`, `LICENCE*`, `COPYING*`, `UNLICENSE`: 1. |
| `lint-config` | 1 | `.editorconfig`, ESLint, Prettier, Ruff, golangci-lint, rustfmt, Biome, pre-commit, flake8, pylint, rubocop, clang-format or stylelint configuration: 1. |
| `containerization` | 0 | Informational only (`Dockerfile`, compose files, `.dockerignore`). Never penalized. |

`license-file` overlaps with the metadata `license` check by up to one point: the metadata check is
GitHub's license detection, this one is the presence of a license file at the root.

### Extra output

- `archetypeHint` (`lib/analysis/archetype.js`): `{ archetype, confidence, signals, scores }`.
  Archetypes: cli-tool, api-service, infrastructure, learning-project, documentation,
  config-dotfiles, framework, library, application, unknown. Each archetype counts matched signals
  (keywords in topics, name and description; a few README headings; file evidence). File evidence
  only counts when the metadata points the same way, except dedicated files such as `*.tf`,
  `openapi.yaml`, dotfiles or `next.config.*`. `strong` = at least two signals and a lead of at
  least one over the runner-up; `weak` = anything else with a signal (ties go to a fixed priority
  order and are reported as weak); `none` = no signal. It is a hint that Laya can refine.
- `archetype` (added by `applyLayaAssessment`): `{ ...archetypeHint, source: 'rule' }` by default.
  When the rules found `none` or `weak` evidence and Laya's `archetype` answer is confident
  (probability at least 0.50, provisional), it is `{ archetype, confidence: 'model', source:
  'model', signals, scores, ruleArchetype, ruleConfidence, model, answerConfidence, threshold }`:
  the model's category, with the rule signals kept for traceability. A `strong` rule-based
  archetype is never replaced, and an uncertain or missing model answer leaves the rule-based one in
  place. The archetype does not affect any score.
- `facts`: the README facts (`lib/analysis/readmeChecks.js`) and the file flags
  (`lib/analysis/structureChecks.js`) the checks were derived from, for later reuse. The README
  text itself is never part of the result.

## Profile score (`scoreProfile`)

Input: `{ user, repos }` from `loadProfile`, `profileReadme` (`{ available }` or undefined for
unknown) and `now`. Weights: identity 30, presentation 40, maintenance 30. Repositories are the
user's own non-fork repositories (`type=owner`, forks excluded). Followers, stars and forks are
never used.

### Identity (30), 13 points

| Check | Max | Rule |
|---|---:|---|
| `bio` | 4 | Biography set. |
| `name` | 2 | Display name set. |
| `website` | 2 | `blog` link set. |
| `location-company` | 1 | Location or company set. Optional: phrased as optional when missing. |
| `profile-readme` | 4 | A `<login>/<login>` repository with a README exists. Unknown when it could not be determined (failed request, repository list truncated before it was found, organizations). |

### Presentation (40), 11 points

Computed over own non-fork repositories. With none, every check is unknown (evidence "no public
non-fork repositories") and the dimension has no score. A repository whose field GitHub did not
send is left out of that check's denominator.

| Check | Max | Rule |
|---|---:|---|
| `descriptions` | 4 | max x share of repositories with a description. |
| `topics` | 3 | max x share with at least one topic. |
| `licenses` | 3 | max x share with a recognized license (an unrecognized license file counts half). |
| `homepages` | 1 | max x share with a homepage. |
| `pinned` | 0 | Always unknown ("not available via the public REST API"). Informational. |

Points are rounded to one decimal (half up). Evidence gives the counts, for example "7 of 10
repositories have a description", and the recommendation names up to three repositories lacking it.

### Maintenance (30), 6 points

Computed over own, non-fork, non-archived repositories. With none, or without push dates, both
checks are unknown.

| Check | Max | Rule |
|---|---:|---|
| `active-share` | 4 | max x share of those repositories pushed within 365 days. |
| `recent-push` | 2 | At least one of them pushed within 90 days: 2. |

When the account has more repositories than the 300 that are loaded, the result carries a note that
only the most recently pushed ones were scored.

## Where the scores are computed

- `/api/profile/[user]` returns `profileReadme` (`{ available }` or null when unknown) and
  `profileScore`.
- `/api/repos/[user]/[repo]/analysis` returns `{ evidenceMeta, analysis, laya }`. `evidenceMeta`
  has `fetchedAt`, `cached`, `stale`, `unavailable` and `readmeTruncated`. `analysis` is the
  deterministic result with the model check and `archetype` applied. `laya` is
  `{ status, model, answers, error? }` with `status` one of `ok`, `partial`, `unavailable`,
  `disabled` or `skipped` (forks); the response is a normal 200 in every case. The raw `/evidence`
  route is unchanged.
- The clock is injected (`now`); the routes pass `Date.now()`.

## Known limitations

- Only the top level of the file listing is visible; tests, CI or docs deeper in the tree are not
  seen. The result says "not found at the repository root".
- Keyword rules cover English and Persian headings. Indented (non-fenced) code blocks are not
  detected. A reStructuredText `~~~~` underline is read as a Markdown code fence.
- Recency and the profile maintenance checks depend on the clock, so the same repository scores
  differently over time even if nothing changed.
- A dimension that is assessed from very few checks still carries its full weight; the dimension
  `coverage` shows how much of it was assessed.

## Change log of weights

| Version | Change |
|---|---|
| 1 (initial) | Repository: documentation 35, metadata 20, maintenance 25, structure 20. Profile: identity 30, presentation 40, maintenance 30. Check maxima as listed above. Weights come from the project's initial scoring framework and have not yet been tuned against labeled examples. |
| 2 | Documentation gains one model check, `laya-readme-sufficiency` (max 2, so 20 points with it). Dimension weights are unchanged. The check is unknown (excluded) unless the Laya prediction is confident, and absent when Laya is disabled. The 0.80 threshold is provisional until `scripts/eval-laya.mjs` has been run. |
