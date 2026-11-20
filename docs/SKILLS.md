# Skill evidence, learning path and comparison

This document describes the three modules built on top of the scoring engine and matches the code
in `lib/analysis/` (`technologies.js`, `skills.js`, `learningPath.js`, `compare.js`). Like
`docs/SCORING.md`, it describes a transparent checklist of **public evidence**, not an assessment
of ability.

## Principles

- Evidence is traceable: every technology and category lists the repositories it came from.
- Strength says how much public evidence was found, never how skilled someone is. Repository
  activity does not prove professional expertise, and the output carries that caveat.
- Language shares are never turned into skill percentages. There are no percentages in the skill
  data; languages appear as repository counts only.
- "No public evidence found" is not a verified negative. A category without evidence is reported
  as `unknown`, never as a lack of skill.
- Model predictions (Laya `skill_category`) are labelled `model-inferred` and are never counted as
  solid evidence.
- Nothing recommends courses, links or certifications.
- Comparisons have no winner, no ranking and no aggregate score.

## Technology table (`lib/analysis/technologies.js`)

A frozen table of 56 technologies, each with `{ id, name, category }`, the eight categories
(`backend`, `frontend`, `systems`, `devops-infrastructure`, `data-engineering`, `mobile`,
`embedded`, `machine-learning`), and its detection signals:

| Signal (source) | How it is matched |
|---|---|
| `language` | `repo.language` equals a listed language name (`Go`, `Rust`, `HCL`, `Jupyter Notebook`, ...). |
| `topic` | A repository topic equals a listed slug exactly (case-insensitive). |
| `description` | A listed keyword occurs in `repo.description`, case-insensitive, with word boundaries: no letter, digit or underscore may touch it, so `react` does not match `reaction`. Spaces and hyphens inside a phrase are interchangeable. Words that are common in prose (`go`, `swift`, `c`, `express`) have no description keywords. |
| `manifest` | A top-level file name from the repository analysis (`facts.structure.manifests`, `.docker`, `.infra`) matches a listed name: `go.mod`, `Cargo.toml`, `pubspec.yaml`, `package.json`, `Dockerfile*`, `*.tf`, ... Only available when repository analyses are passed. |

A technology serving several areas (Go, Python, TypeScript, JavaScript, C, C++, Jupyter) lists
`alsoCategories` and is **broad**; so are a few single-category general-purpose ones (Java, C#,
Ruby, PHP, Shell, Node.js). A broad technology is reported as an observed technology but gives only
**weak** evidence for its categories, because a language alone does not say what was built.
Specific technologies (Rust, Kotlin, Swift, Dart, HCL/Terraform and every framework or tool) give
solid evidence.

## Skill evidence (`buildSkillEvidence`)

Input: `{ repos, repoAnalyses = [], layaCategories = {} }` and `{ now }`. Only the user's own,
non-fork repositories count; forks are only counted in `notCounted.forks`.

**Deduplication.** A repository counts once per technology, keeping its strongest source in the
order `manifest > topic > language > description`.

**Technology strength** (over repositories, after deduplication):

| Strength | Rule |
|---|---|
| `repeated` | at least 3 repositories, at least one with a source other than the description |
| `observed` | 2 repositories, or 1 repository with a topic or manifest source |
| `weak` | a single language or description mention |

**Category strength.** A repository is *solid* evidence for a category when a non-broad technology
of the category is `observed` or `repeated` in it; broad technologies, weak mentions and model
predictions are *weak* evidence.

| Strength | Rule |
|---|---|
| `repeated` | at least 3 distinct solid repositories |
| `observed` | 1 or 2 solid repositories |
| `weak` | only weak evidence (or only model predictions) |
| `unknown` | no evidence: "No public evidence found in the analyzed repositories." |

**Model predictions.** `layaCategories[full_name]` holds the Laya `skill_category` answer
(`{ value, state }`). Only `confident` answers for one of the eight categories (not `other`) for
counted repositories are used. They add an item `{ repo, source: 'model', detail }` to the
category's `modelEvidence` and make a category with no other evidence `weak` with
`source: 'model-inferred'`. They never raise a category above what the deterministic evidence
supports.

**Recency.** Each category has `lastActivity` (newest `pushed_at` among its repositories) and
`recent` (within 365 days of `now`). Both are `null` when no push date is known; unknown recency is
never "not recent".

**Result.** `{ categories, technologies, analyzed: { repos }, notCounted: { forks }, caveats }`.
Categories carry `strength`, `source` (`observed`, `model-inferred` or `none`), `repos`,
`technologies`, `modelEvidence`, `lastActivity`, `recent` and a `note`. Technologies carry their
`evidence` items `{ repo, source, detail }`. Both lists are sorted by strength, then repository
count, then name, so the output is deterministic and independent of input order.

The profile route computes the map from the repository list (`skills` in `/api/profile/[user]`),
so without repository analyses no `manifest` evidence is used and the caveats say so.

## Learning path (`buildLearningPath`)

Input: `{ skills, profileScore, repoAnalyses = [] }` and `{ role }`. An unknown role throws a
`RangeError` (the API answers 400). Each role in `ROLES` is a frozen ruleset:
`{ id, label, core, foundations, projectIdeas, portfolio }`.

| Role | Core categories | Foundations (priority) |
|---|---|---|
| `backend` | backend | HTTP framework (1), relational database (1), API design (2), containerization (2), automated testing (2) |
| `frontend` | frontend | UI framework (1), TypeScript (2), automated testing (2) |
| `fullstack` | frontend, backend | UI framework (1), HTTP framework (1), relational database (2), API design (2), automated testing (2), containerization (3) |
| `devops` | devops-infrastructure | containerization (1), infrastructure as code (1), container orchestration (2), shell scripting (2), continuous integration (2) |
| `systems` | systems | systems programming language (1), operating-system concepts (2), automated testing (2), language implementation (3) |
| `data-engineering` | data-engineering | data-processing tools (1), SQL database (1), workflow orchestration (2), automated testing (2), message streaming (3) |

A foundation is satisfied by technologies (`satisfiedBy.technologies`, any `observed` or
`repeated` evidence) or by file-listing flags (`satisfiedBy.structure`, from repository analyses:
tests, CI). Its status is `satisfied`, `weak` (only weak mentions), `missing` (no public evidence
found) or `unknown` (no repositories, or file listings not analyzed).

**Steps** (`{ id, kind, title, rationale, evidenceStrength, basedOn, priority }`, at most 8,
sorted by priority 1-3):

- `foundation`: a foundation that is not satisfied. Priority from the table; an `unknown` one that
  is only unknown because file listings are missing is a priority-3 reminder.
- `project`: a project idea of the role whose trigger foundations are missing or weak. With no
  public repositories at all, one "publish a first public project" step (priority 1).
- `portfolio`: a project type of the role (archetype from the repository analyses: the model's
  when confident, else the rule-based hint) that none of the analyzed repositories matches.
  Priority 2. Needs repository analyses; without them nothing is reported and a note says so.
  Always `weak`, because archetypes are hints.
- `repo-improvement`: the two highest-impact recommendations of the profile score and the
  repository analyses, reusing their text unchanged (repository recommendations are merged per
  check, with the mean impact over the analyzed repositories). Priority 2 at an impact of 5 or more
  overall points, else 3. They are always kept when the list is cut at 8.

**Evidence strength.** `strong`: a gap judged on at least 5 repositories (3 repository analyses
for file-based foundations) in a role whose core area has evidence, or a recommendation from a
verified or rule check. `weak`: fewer repositories, a core area without evidence, weak mentions,
a model-based check, or a profile score with coverage below 0.5. `none`: nothing could be
assessed. Every `weak` or `none` rationale starts with "Based on limited public evidence:".

**Summary.** `coreCoverage` is `strong` when every core category is `repeated`, `none` when none
has evidence, `partial` otherwise, and `unknown` without public repositories. The summary also
lists each foundation with its status and traceable repositories, and notes about what could not
be assessed. File-based foundations only see the repository root.

`GET /api/learning-path/[user]?role=backend` builds the path from the loaded profile (skills and
profile score only; no repository analyses are fetched).

## Comparison (`compareProfiles`)

`compareProfiles(a, b, { now })` takes two `{ user, repos, profileScore, skills }` sides (the
`loadProfile` output) and is symmetric: swapping the sides mirrors the result. `GET
/api/compare?a=user1&b=user2` rejects invalid or identical (case-insensitive) usernames with 400,
answers 404 with `error.which` (`a` or `b`) for a missing user, and reports a rate limit or an
upstream failure before a missing user.

| Part | Content |
|---|---|
| `metrics` | Rows `{ id, label, a, b, unit, note, popularity, aOf?, bOf? }`: public own repositories, stars, forks and followers (`popularity: true`, labelled "popularity, not quality"), profile checklist score, label and coverage, repositories with a description, a recognized license and topics (`a` of `aOf`), repositories pushed within 365 days, account age. Unknown values are `null`, never 0. |
| `languages` | Union of each side's 8 most used primary languages with repository counts and `relation` (`shared`, `only-a`, `only-b`). Counts only. |
| `skills` | Categories `overlap` (both at least `observed`), `distinctiveToA`, `distinctiveToB` and `unknownInBoth`. Weak evidence does not count as observed. |
| `activity` | Repositories created and last pushed per year (a continuous year range). These are repository dates, not commit history. |
| `differences` | At most 4 neutral sentences, largest first, such as "alice has more repositories with a recognized license (8/10 vs 2/9)". |

**Differences** use only the repository and profile-checklist rows. A gap must be at least 0.2:
the difference of the shares for share rows, the relative difference for repository counts, and
the score difference divided by 100 for the profile score. Popularity rows, the label, the
coverage and the account age are never listed, because attention and age say nothing about
quality.

**Excluded on purpose.** There is no winner, no aggregate or weighted comparison score, no
ranking, and no popularity-based claim. The caveats say that stars, forks and followers measure
attention, that profile scores are checklists and not a ranking of developers, and that private
work is invisible.

## Known limitations

- Detection is name-based. A topic or keyword is a claim by the repository owner, and a README
  that mentions a technology is not read for this map.
- Without repository analyses there is no manifest evidence and file-based foundations cannot be
  assessed; the profile route does not fetch analyses (one request set per repository).
- Language topics (`python`, `javascript`, ...) are tied to broad technologies and therefore never
  count as solid category evidence.
- The Laya `skill_category` question is supported by `buildSkillEvidence` but not yet asked by any
  route; its threshold is provisional (`docs/LAYA.md`).
