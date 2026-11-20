# Laya evaluation set

`labels.jsonl` holds 30 hand-written README fixtures with expected answers for the Laya
questions in `lib/laya/questions.js`. `scripts/eval-laya.mjs` sends them through the same code the
application uses and reports how the model behaves under the current thresholds.

**The labels were assigned by the developer (one person, no second annotator).** They are a
small smoke-level reference, not a benchmark. The README texts are invented for this purpose and
do not come from real repositories.

## Format

One JSON object per line:

| Field | Meaning |
|---|---|
| `id` | `f01` to `f30` |
| `lang` | `en` or `fa` (Persian) |
| `category` | How the fixture was written (good, missing-install, minimal, injection, ...) |
| `repo` | `name`, `description`, `topics`, `language`, `files` (top-level names). Used for the repository summary |
| `readme` | The README text |
| `labels` | Gold answers: `readme_sufficient` (bool), `usage_examples` (bool), `install_clarity` (0, 1 or 2), `archetype` (one of the 9 archetypes) |
| `injection` | Only on the prompt-injection fixtures: the injected text and the answers it tries to force |

`docs_completeness` and `skill_category` have no gold labels yet.

## Labeling rules

- `readme_sufficient` is true when the README states what the project is **and** gives at least one
  concrete first step (an install or setup command, a run command or a usage example). A vague
  "install the dependencies and run it" is not a concrete step.
- `usage_examples` is true when the README text contains at least one concrete example of using
  the project (a command, a code snippet). A table of endpoints without an example is false.
  Images are removed before the model sees the README, so a screenshot never counts.
- `install_clarity`: 0 = no installation or setup instructions; 1 = partial or vague (a pointer to
  a tool without commands, or a sentence without a command); 2 = clear steps or a concrete install
  command.
- `archetype` is the single best fit among the 9 archetypes, judged from the repository summary.

## Composition

24 plain English, 4 Persian and 2 prompt-injection fixtures. Good READMEs, missing installation,
missing usage, one-line READMEs, vague setup, a curated list, a dotfiles repository and learning
projects are all represented. All 9 archetypes occur. With 4 Persian fixtures any Persian number
is only indicative.

## Running

```sh
LAYA_URL=http://127.0.0.1:8000 NODE_NO_WARNINGS=1 node scripts/eval-laya.mjs
```

The script exits 0, does not run in CI and needs a running `laya-serve` (see `docs/LAYA.md`).
Record the results in the "Measured results" section of `docs/LAYA.md`, together with the
checkpoint revision and the date, before changing any threshold.
