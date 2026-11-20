import { detectArchetype } from './archetype';
import { repoFacts } from './facts';
import { LABEL_INSUFFICIENT } from './labels';
import { buildAssessment, buildDimension, scored, unknownCheck } from './scoring';
import { ageInDays, hasText, licenseState, toMs } from './signals';

export const REPO_WEIGHTS = {
  documentation: 35,
  metadata: 20,
  maintenance: 25,
  structure: 20,
};

// Age of the last push (in days, inclusive) and the points it earns. Older than the last
// threshold earns 0.
export const RECENCY_TIERS = [
  { maxDays: 90, points: 5 },
  { maxDays: 365, points: 3 },
  { maxDays: 730, points: 1 },
];

export const SUBSTANTIVE_WORDS = 150;
export const SHORT_README_WORDS = 50;
export const STRUCTURED_HEADINGS = 3;
export const DESCRIPTION_MIN_LENGTH = 20;
export const TOPICS_FULL = 3;

const FORK_NOTE = 'Forks are not scored, as their content mostly reflects the upstream repository.';
const TRUNCATED_UNKNOWN =
  'the README was cut at 100 KB and the remaining content was not inspected';

// Section keywords are matched in English and Persian. For a README written mostly in another
// script a "not found" result says nothing, so it is reported as unknown instead of as a gap.
const UNCOVERED_SCRIPTS = ['cjk', 'cyrillic'];
const MIN_WORDS_FOR_SCRIPT_GAP = 20;

const readmeGapOf = (evidence, readme) => {
  if (!readme) return null;
  if (evidence.readme.truncated) return TRUNCATED_UNKNOWN;
  const uncovered =
    UNCOVERED_SCRIPTS.includes(readme.script) ||
    (readme.script === 'other' && readme.wordCount >= MIN_WORDS_FOR_SCRIPT_GAP);
  return uncovered
    ? `the README is written mostly in a script (${readme.script}) that the keyword rules do not cover`
    : null;
};

const found = list => Array.isArray(list) && list.length > 0;
const names = list => list.join(', ');
const isoDate = value => (Number.isFinite(Date.parse(value)) ? value.slice(0, 10) : 'unknown date');

// Where each piece of evidence stands: 'present', 'absent' (GitHub confirmed there is none)
// or 'unknown' (could not be retrieved). An empty repository has no file listing.
const readmeStateOf = evidence => {
  if (evidence.unavailable?.includes('readme') || !evidence.readme) return 'unknown';
  if (!evidence.readme.available) return 'absent';
  return typeof evidence.readme.text === 'string' ? 'present' : 'unknown';
};

const treeStateOf = (evidence, facts) => {
  if (evidence.unavailable?.includes('tree') || evidence.tree === undefined) return 'unknown';
  return facts.structure ? 'present' : 'empty';
};

// ---------------------------------------------------------------------------------------------
// Documentation (weight 35)
// ---------------------------------------------------------------------------------------------

// A check derived from the README text. A confirmed-absent README is a verified negative, so
// these checks then score 0; an unavailable README leaves them unknown.
const readmeCheck = (ctx, { id, label, max, recommendation, evaluate, keywordBased }) => {
  if (ctx.readmeState === 'unknown') {
    return unknownCheck({ id, label, max, evidence: 'the README could not be retrieved' });
  }
  if (ctx.readmeState === 'absent') {
    return scored({
      id,
      label,
      points: 0,
      max,
      status: 'rule',
      evidence: 'the repository has no README to inspect',
      recommendation,
    });
  }
  const result = evaluate(ctx.readme);
  if (keywordBased && result.points === 0 && ctx.readmeGap) {
    return unknownCheck({ id, label, max, evidence: `not found, but ${ctx.readmeGap}` });
  }
  return scored({ id, label, max, status: 'rule', recommendation, ...result });
};

// A check satisfied by either the README or a file at the repository root. It is only a
// negative when every source was actually inspected.
const readmeOrTreeCheck = (ctx, { id, label, max, recommendation, readmeEvidence, treeNames }) => {
  const parts = [];
  if (readmeEvidence) parts.push(`README: ${readmeEvidence}`);
  if (found(treeNames)) parts.push(`repository root: found ${names(treeNames)}`);
  if (parts.length > 0) {
    return scored({
      id,
      label,
      points: max,
      max,
      status: readmeEvidence ? 'rule' : 'verified',
      evidence: parts.join('; '),
    });
  }

  const missing = [];
  if (ctx.readmeState === 'unknown') missing.push('the README could not be retrieved');
  if (ctx.readmeState === 'present' && ctx.readmeGap) missing.push(ctx.readmeGap);
  if (ctx.treeState === 'unknown')
    missing.push('the repository file listing could not be retrieved');
  if (missing.length > 0) {
    return unknownCheck({ id, label, max, evidence: `not found, but ${missing.join(' and ')}` });
  }
  const inspected =
    ctx.readmeState === 'present' ? 'the README or the repository root' : 'the repository root';
  return scored({
    id,
    label,
    points: 0,
    max,
    status: 'rule',
    evidence: `not found in ${inspected}`,
    recommendation,
  });
};

const documentationChecks = ctx => {
  const { readmeState, readme } = ctx;

  const hasReadme =
    readmeState === 'unknown'
      ? unknownCheck({
          id: 'readme',
          label: 'README',
          max: 4,
          evidence: 'the README could not be retrieved from GitHub',
        })
      : scored({
          id: 'readme',
          label: 'README',
          points: readmeState === 'present' ? 4 : 0,
          max: 4,
          status: 'verified',
          evidence:
            readmeState === 'present'
              ? `README found (${readme.wordCount} words)`
              : 'GitHub reports no README for this repository',
          recommendation: 'Add a README.md that explains what the project does and how to use it.',
        });

  const length = readmeCheck(ctx, {
    id: 'readme-length',
    label: 'README length',
    max: 3,
    recommendation:
      'Expand the README so a newcomer can understand the project (aim for 150+ words).',
    evaluate: f => {
      if (f.wordCount >= SUBSTANTIVE_WORDS) {
        return { points: 3, evidence: `${f.wordCount} words of prose (150 or more)` };
      }
      if (f.wordCount >= SHORT_README_WORDS) {
        return { points: 1.5, evidence: `${f.wordCount} words of prose (50 to 149)` };
      }
      return { points: 0, evidence: `${f.wordCount} words of prose (fewer than 50)` };
    },
  });

  const install = readmeCheck(ctx, {
    id: 'install',
    label: 'Installation instructions',
    max: 3,
    recommendation: 'Add an Installation section with the commands needed to set the project up.',
    keywordBased: true,
    evaluate: f => {
      if (f.hasInstallCommand) {
        return {
          points: 3,
          evidence: `install command found in a code block (${f.installCommand})${
            f.matches.install?.startsWith('command') ? '' : `; ${f.matches.install}`
          }`,
        };
      }
      if (f.hasInstallSection) {
        return {
          points: 2,
          evidence: `${f.matches.install} found, but no recognized install command in a code block`,
        };
      }
      return { points: 0, evidence: 'no installation section or install command found' };
    },
  });

  const usage = readmeCheck(ctx, {
    id: 'usage',
    label: 'Usage examples',
    max: 3,
    recommendation: 'Add a Usage section with at least one code example.',
    keywordBased: true,
    evaluate: f => {
      if (f.hasUsageSection && f.usageCodeBlocks > 0) {
        return {
          points: 3,
          evidence: `${f.matches.usage}; ${f.usageCodeBlocks} code block(s) beneath it`,
        };
      }
      if (f.hasUsageSection) {
        return {
          points: 2,
          evidence: `${f.matches.usage} found, but no code example detected beneath it`,
        };
      }
      return { points: 0, evidence: 'no usage or examples section found' };
    },
  });

  const structure = readmeCheck(ctx, {
    id: 'readme-structure',
    label: 'README structure',
    max: 2,
    recommendation: 'Organize the README into sections with headings (at least three).',
    evaluate: f => {
      if (f.headingCount >= STRUCTURED_HEADINGS) {
        return { points: 2, evidence: `${f.headingCount} headings` };
      }
      if (f.headingCount > 0) {
        return { points: 1, evidence: `${f.headingCount} heading(s) (fewer than 3)` };
      }
      return { points: 0, evidence: 'no headings found' };
    },
  });

  const config = readmeCheck(ctx, {
    id: 'configuration',
    label: 'Configuration docs',
    max: 1,
    recommendation:
      'If the project is configurable, document its options or environment variables in the README.',
    keywordBased: true,
    evaluate: f =>
      f.hasConfigSection
        ? { points: 1, evidence: String(f.matches.config) }
        : { points: 0, evidence: 'no configuration or environment section found' },
  });

  const contributing = readmeOrTreeCheck(ctx, {
    id: 'contributing',
    label: 'Contribution info',
    max: 1,
    recommendation: 'Add contribution guidance (a CONTRIBUTING file or a README section).',
    readmeEvidence: readme?.hasContributing ? readme.matches.contributing : null,
    treeNames: ctx.tree?.contributing,
  });

  const docs = readmeOrTreeCheck(ctx, {
    id: 'docs-reference',
    label: 'Documentation directory or reference',
    max: 1,
    recommendation:
      'Add a docs/ directory or link to API or project documentation from the README.',
    readmeEvidence: readme?.hasApiDocs ? readme.matches.api : null,
    treeNames: ctx.tree?.docsDir,
  });

  return [hasReadme, length, install, usage, structure, config, contributing, docs];
};

// ---------------------------------------------------------------------------------------------
// Repository metadata (weight 20). These fields come with the repository itself, so they are
// always known; a field GitHub did not send is reported as unknown rather than as missing.
// ---------------------------------------------------------------------------------------------

const metadataChecks = repo => {
  const description = (() => {
    const base = { id: 'description', label: 'Description', max: 4 };
    if (repo.description === undefined) {
      return unknownCheck({ ...base, evidence: 'the description field was not provided' });
    }
    const text = hasText(repo.description) ? repo.description.trim() : '';
    const recommendation =
      'Add a one-sentence description (at least 20 characters) to the repository.';
    if (text.length >= DESCRIPTION_MIN_LENGTH) {
      return scored({
        ...base,
        points: 4,
        status: 'verified',
        evidence: `description set (${text.length} characters)`,
      });
    }
    if (text.length > 0) {
      return scored({
        ...base,
        points: 2,
        status: 'verified',
        evidence: `description is short (${text.length} characters, under 20)`,
        recommendation,
      });
    }
    return scored({
      ...base,
      points: 0,
      status: 'verified',
      evidence: 'no description set',
      recommendation,
    });
  })();

  const topics = (() => {
    const base = { id: 'topics', label: 'Topics', max: 3 };
    if (!Array.isArray(repo.topics)) {
      return unknownCheck({ ...base, evidence: 'the topics field was not provided' });
    }
    const count = repo.topics.length;
    const recommendation =
      'Add at least three topics so the repository can be categorized and found.';
    if (count >= TOPICS_FULL) {
      return scored({ ...base, points: 3, status: 'verified', evidence: `${count} topics set` });
    }
    return scored({
      ...base,
      points: count > 0 ? 1.5 : 0,
      status: 'verified',
      evidence: count > 0 ? `${count} topic(s) set (fewer than 3)` : 'no topics set',
      recommendation,
    });
  })();

  const license = (() => {
    const base = { id: 'license', label: 'License', max: 4 };
    const state = licenseState(repo);
    const recommendation = 'Add a LICENSE file with a standard license that GitHub can recognize.';
    if (state === 'unknown') {
      return unknownCheck({ ...base, evidence: 'the license field was not provided' });
    }
    if (state === 'recognized') {
      return scored({
        ...base,
        points: 4,
        status: 'verified',
        evidence: `license detected (${repo.license.spdx_id})`,
      });
    }
    if (state === 'unrecognized') {
      return scored({
        ...base,
        points: 2,
        status: 'verified',
        evidence: 'license file present but not recognized by GitHub',
        recommendation,
      });
    }
    return scored({
      ...base,
      points: 0,
      status: 'verified',
      evidence: 'GitHub detected no license file',
      recommendation,
    });
  })();

  const homepage = (() => {
    const base = { id: 'homepage', label: 'Homepage', max: 1 };
    if (repo.homepage === undefined) {
      return unknownCheck({ ...base, evidence: 'the homepage field was not provided' });
    }
    return hasText(repo.homepage)
      ? scored({
          ...base,
          points: 1,
          status: 'verified',
          evidence: `homepage set (${repo.homepage.trim()})`,
        })
      : scored({
          ...base,
          points: 0,
          status: 'verified',
          evidence: 'no homepage set',
          recommendation:
            'If the project has a website or documentation site, set it as the homepage.',
        });
  })();

  return [description, topics, license, homepage];
};

// ---------------------------------------------------------------------------------------------
// Maintenance (weight 25). Open issue and pull request counts are deliberately not used: a high
// count can mean an active community as easily as neglect.
// ---------------------------------------------------------------------------------------------

const maintenanceChecks = (evidence, nowMs) => {
  const { repo, release } = evidence;
  const unavailable = evidence.unavailable ?? [];

  const recency = (() => {
    const base = { id: 'recency', label: 'Recent activity', max: 5 };
    const days = ageInDays(repo.pushed_at, nowMs);
    if (days === null)
      return unknownCheck({ ...base, evidence: 'the last push date was not provided' });
    const tier = RECENCY_TIERS.find(candidate => days <= candidate.maxDays);
    return scored({
      ...base,
      points: tier ? tier.points : 0,
      status: 'rule',
      evidence: `last push ${Math.floor(days)} days ago (${isoDate(repo.pushed_at)})`,
      recommendation: 'Push updates, or archive the repository if it is no longer maintained.',
    });
  })();

  const archived = (() => {
    const base = { id: 'not-archived', label: 'Not archived', max: 3 };
    if (repo.archived === undefined) {
      return unknownCheck({ ...base, evidence: 'the archived flag was not provided' });
    }
    return scored({
      ...base,
      points: repo.archived ? 0 : 3,
      status: 'verified',
      evidence: repo.archived
        ? 'the repository is archived (a deliberate, read-only state)'
        : 'the repository is not archived',
      recommendation:
        'Note in the README that the project is archived, and point to a successor if there is one.',
    });
  })();

  const releases = (() => {
    const base = { id: 'releases', label: 'Releases', max: 2 };
    if (unavailable.includes('release') || release === undefined) {
      return unknownCheck({ ...base, evidence: 'release information could not be retrieved' });
    }
    if (release) {
      return scored({
        ...base,
        points: 2,
        status: 'verified',
        evidence: `latest release ${release.tag_name} (${isoDate(release.published_at)})`,
      });
    }
    return scored({
      ...base,
      points: 0,
      status: 'rule',
      evidence: 'no published release found (drafts and pre-releases are not counted)',
      recommendation:
        'Publish releases for versioned deliverables. Not every project needs releases.',
    });
  })();

  const issues = (() => {
    const base = { id: 'issues-enabled', label: 'Issues enabled', max: 1 };
    if (repo.has_issues === undefined) {
      return unknownCheck({ ...base, evidence: 'the issues setting was not provided' });
    }
    return scored({
      ...base,
      points: repo.has_issues ? 1 : 0,
      status: 'verified',
      evidence: repo.has_issues ? 'GitHub Issues are enabled' : 'GitHub Issues are disabled',
      recommendation: 'Enable GitHub Issues so users have a place to report problems.',
    });
  })();

  return [recency, archived, releases, issues];
};

// ---------------------------------------------------------------------------------------------
// Project structure (weight 20). Only root-level names are visible, so a missing entry means
// "not found at the root", not "does not exist".
// ---------------------------------------------------------------------------------------------

const structureChecks = ctx => {
  const { tree, treeState } = ctx;

  if (!tree) {
    const evidence =
      treeState === 'empty'
        ? 'the repository is empty'
        : 'the repository file listing could not be retrieved';
    return [
      { id: 'source-layout', label: 'Source layout and manifest', max: 3 },
      { id: 'tests', label: 'Tests', max: 3 },
      { id: 'ci', label: 'Continuous integration', max: 2 },
      { id: 'license-file', label: 'License file', max: 1 },
      { id: 'lint-config', label: 'Lint or format config', max: 1 },
      { id: 'containerization', label: 'Containerization (informational)', max: 0 },
    ].map(check => unknownCheck({ ...check, evidence }));
  }

  const presence = ({ id, label, max, list, noun, recommendation, note = '' }) =>
    found(list)
      ? scored({
          id,
          label,
          points: max,
          max,
          status: 'verified',
          evidence: `found ${names(list)}${note}`,
        })
      : scored({
          id,
          label,
          points: 0,
          max,
          status: 'rule',
          evidence: `no ${noun} found at the repository root`,
          recommendation,
        });

  const hasSource = found(tree.sourceDir) || found(tree.sourceFiles);
  const hasManifest = found(tree.manifests);
  const sourceNames = found(tree.sourceDir) ? tree.sourceDir : tree.sourceFiles;
  const sourcePoints = (hasSource ? 2 : 0) + (hasManifest ? 1 : 0);
  const sourceLayout = scored({
    id: 'source-layout',
    label: 'Source layout and manifest',
    points: sourcePoints,
    max: 3,
    status: sourcePoints > 0 ? 'verified' : 'rule',
    evidence: [
      hasSource
        ? `source: ${names(sourceNames)}`
        : 'no source directory or top-level source files found',
      hasManifest ? `manifest: ${names(tree.manifests)}` : 'no dependency or build manifest found',
    ].join('; '),
    recommendation:
      'Keep source code in a conventional directory (for example src/) and declare dependencies in a manifest.',
  });

  const tests = presence({
    id: 'tests',
    label: 'Tests',
    max: 3,
    list: tree.tests,
    noun: 'test directory or test files',
    recommendation: 'Add automated tests, ideally in a conventional directory such as tests/.',
    note: ' (presence says nothing about how thorough the tests are)',
  });

  const ci = (() => {
    const base = { id: 'ci', label: 'Continuous integration', max: 2 };
    if (found(tree.ci)) {
      return scored({
        ...base,
        points: 2,
        status: 'verified',
        evidence: `found ${names(tree.ci)}`,
      });
    }
    if (found(tree.possibleCi)) {
      return scored({
        ...base,
        points: 1,
        status: 'rule',
        evidence: 'possible CI (.github directory); its contents are not inspected',
        recommendation: 'Add a CI workflow that builds and tests the project on every push.',
      });
    }
    return scored({
      ...base,
      points: 0,
      status: 'rule',
      evidence: 'no CI configuration found at the repository root',
      recommendation:
        'Add a CI workflow (for example GitHub Actions) that builds and tests the project.',
    });
  })();

  const licenseFile = presence({
    id: 'license-file',
    label: 'License file',
    max: 1,
    list: tree.license,
    noun: 'license file',
    recommendation: 'Add a LICENSE file to the repository root.',
  });

  const lint = presence({
    id: 'lint-config',
    label: 'Lint or format config',
    max: 1,
    list: tree.lint,
    noun: 'linter or formatter configuration',
    recommendation: 'Add a linter or formatter configuration (for example .editorconfig).',
  });

  const containerization = scored({
    id: 'containerization',
    label: 'Containerization (informational)',
    points: 0,
    max: 0,
    status: found(tree.docker) ? 'verified' : 'rule',
    evidence: found(tree.docker)
      ? `found ${names(tree.docker)} (informational, not scored)`
      : 'no container files found at the repository root (informational, never penalized)',
  });

  return [sourceLayout, tests, ci, licenseFile, lint, containerization];
};

/**
 * Scores one repository from collected evidence (the output of `loadRepoEvidence`).
 * Pure: the result depends only on the arguments. `now` (Date or ms) is required.
 * Popularity (stars, forks, watchers) and open issue counts are never inputs to the score.
 */
export const scoreRepository = (evidence, { now } = {}) => {
  const nowMs = toMs(now);
  const { repo } = evidence;
  const facts = repoFacts(evidence);
  const archetypeHint = detectArchetype(evidence, facts);
  const subject = repo.full_name ?? repo.name ?? null;

  if (repo.fork === true) {
    return {
      subject,
      score: null,
      label: LABEL_INSUFFICIENT,
      coverage: 0,
      dimensions: [],
      strengths: [],
      weaknesses: [],
      unknowns: [],
      recommendations: [],
      notes: [FORK_NOTE],
      archetypeHint,
      facts,
    };
  }

  const ctx = {
    readmeState: readmeStateOf(evidence),
    readmeGap: readmeGapOf(evidence, facts.readme),
    readme: facts.readme,
    tree: facts.structure,
    treeState: treeStateOf(evidence, facts),
  };

  const dimensions = [
    buildDimension({
      id: 'documentation',
      label: 'Documentation',
      weight: REPO_WEIGHTS.documentation,
      checks: documentationChecks(ctx),
    }),
    buildDimension({
      id: 'metadata',
      label: 'Repository metadata',
      weight: REPO_WEIGHTS.metadata,
      checks: metadataChecks(repo),
    }),
    buildDimension({
      id: 'maintenance',
      label: 'Maintenance',
      weight: REPO_WEIGHTS.maintenance,
      checks: maintenanceChecks(evidence, nowMs),
    }),
    buildDimension({
      id: 'structure',
      label: 'Project structure',
      weight: REPO_WEIGHTS.structure,
      checks: structureChecks(ctx),
    }),
  ];

  const notes = [];
  if (ctx.readmeState === 'present' && evidence.readme.truncated) {
    notes.push('The README was cut at 100 KB; only the first part was analyzed.');
  }
  if (ctx.readmeGap && !evidence.readme.truncated) {
    notes.push(`Section checks were left unknown: ${ctx.readmeGap}.`);
  }

  return { subject, ...buildAssessment(dimensions), notes, archetypeHint, facts };
};
