import {
  CATEGORIES,
  CATEGORY_IDS,
  SOURCE_ORDER,
  TECHNOLOGIES,
  detectTechnologies,
} from './technologies';
import { ageInDays, plural, toMs } from './signals';

// Builds the skill evidence map: which technologies and technical areas the public, non-fork
// repositories give evidence for, and where each piece of evidence comes from. It describes
// *evidence*, never skill level: repository activity does not prove professional expertise, and
// language shares are never turned into skill percentages. See docs/SKILLS.md.

export const RECENT_WITHIN_DAYS = 365;
export const REPEATED_MIN_REPOS = 3;

/** Strengths, weakest first. `unknown` means no public evidence was found, not "no skill". */
export const STRENGTHS = Object.freeze(['unknown', 'weak', 'observed', 'repeated']);
const RANK = Object.fromEntries(STRENGTHS.map((strength, index) => [strength, index]));

// Name lists of an analysis (`facts.structure`) that can carry manifest evidence.
const FILE_FLAGS = ['manifests', 'docker', 'infra'];

export const NO_EVIDENCE_NOTE = 'No public evidence found in the analyzed repositories.';

const BASE_CAVEATS = [
  'Strength describes how much public evidence was found, not how skilled someone is.',
  'Repository activity does not prove professional expertise.',
  'Missing evidence is not a verified negative: private work and other platforms are not visible.',
];

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byRepo = (a, b) => byName(a.repo, b.repo);

// Strongest first, then the one with more repositories, then by name.
const bySignificance = (a, b) =>
  RANK[b.strength] - RANK[a.strength] ||
  b.repoCount - a.repoCount ||
  byName(a.name ?? a.label, b.name ?? b.label);

const repoName = repo => (typeof repo?.full_name === 'string' ? repo.full_name : repo?.name);

/**
 * Strength of one technology from its deduplicated evidence (one item per repository):
 * - repeated: at least 3 repositories, at least one with a source other than the description;
 * - observed: 2 repositories, or 1 repository with a topic or manifest source;
 * - weak: a single language or description mention.
 */
const technologyStrength = evidence => {
  if (
    evidence.length >= REPEATED_MIN_REPOS &&
    evidence.some(item => item.source !== 'description')
  ) {
    return 'repeated';
  }
  if (evidence.length >= 2) return 'observed';
  if (evidence.length === 1 && ['topic', 'manifest'].includes(evidence[0].source)) {
    return 'observed';
  }
  return 'weak';
};

// File names found at the root of each analyzed repository, by lower-case full name.
const fileNamesBySubject = repoAnalyses => {
  const bySubject = new Map();
  repoAnalyses.forEach(analysis => {
    const structure = analysis?.facts?.structure;
    if (typeof analysis?.subject !== 'string' || !structure) return;
    const names = FILE_FLAGS.flatMap(flag =>
      Array.isArray(structure[flag]) ? structure[flag] : [],
    );
    bySubject.set(analysis.subject.toLowerCase(), names);
  });
  return bySubject;
};

// technology id -> repository name -> the strongest piece of evidence of that repository.
const collectEvidence = (own, fileNames) => {
  const byTechnology = new Map();
  own.forEach(repo => {
    const name = repoName(repo);
    detectTechnologies(repo, fileNames.get(name.toLowerCase()) ?? []).forEach(hit => {
      const perRepo = byTechnology.get(hit.technology) ?? new Map();
      byTechnology.set(hit.technology, perRepo);
      const kept = perRepo.get(name);
      if (!kept || SOURCE_ORDER.indexOf(hit.source) < SOURCE_ORDER.indexOf(kept.source)) {
        perRepo.set(name, { repo: name, source: hit.source, detail: hit.detail });
      }
    });
  });
  return byTechnology;
};

const buildTechnologies = byTechnology =>
  TECHNOLOGIES.filter(technology => byTechnology.has(technology.id))
    .map(technology => {
      const evidence = [...byTechnology.get(technology.id).values()].sort(byRepo);
      return {
        id: technology.id,
        name: technology.name,
        category: technology.category,
        alsoCategories: [...technology.alsoCategories],
        broad: technology.broad,
        strength: technologyStrength(evidence),
        repoCount: evidence.length,
        evidence,
      };
    })
    .sort(bySignificance);

// Confident Laya answers of the `skill_category` question for repositories being analyzed.
// `other`, uncertain and unknown answers add nothing.
const collectModelEvidence = (own, layaCategories) => {
  const byCategory = new Map(CATEGORY_IDS.map(id => [id, []]));
  own.forEach(repo => {
    const name = repoName(repo);
    const answer = layaCategories?.[name];
    if (answer?.state !== 'confident' || !byCategory.has(answer.value)) return;
    byCategory.get(answer.value).push({
      repo: name,
      source: 'model',
      detail: `Laya prediction (not verified): ${answer.value}`,
    });
  });
  byCategory.forEach(items => items.sort(byRepo));
  return byCategory;
};

const categoryNote = (strength, source, solidCount) => {
  if (strength === 'unknown') return NO_EVIDENCE_NOTE;
  if (source === 'model-inferred') {
    return 'Only a Laya model prediction points here; it is not a verified fact.';
  }
  if (strength === 'weak') {
    return 'Only weak evidence was found: a general-purpose language, a single description mention, or a model prediction.';
  }
  return `${strength === 'repeated' ? 'Repeated evidence' : 'Evidence'} in ${plural(solidCount, 'repository', 'repositories')}.`;
};

const buildCategories = (technologies, modelEvidence, repoByName, nowMs) =>
  CATEGORIES.map(category => {
    const members = technologies.filter(
      technology =>
        technology.category === category.id || technology.alsoCategories.includes(category.id),
    );

    // A repository counts as solid evidence when a specific technology of the category is
    // observed or repeated. General-purpose technologies and weak mentions only count as weak.
    const solid = new Set();
    const weak = new Set();
    members.forEach(technology => {
      const isSolid = !technology.broad && RANK[technology.strength] >= RANK.observed;
      technology.evidence.forEach(item => (isSolid ? solid : weak).add(item.repo));
    });
    const modelItems = modelEvidence.get(category.id);
    const modelRepos = modelItems.map(item => item.repo);

    let strength = 'unknown';
    if (solid.size >= REPEATED_MIN_REPOS) strength = 'repeated';
    else if (solid.size >= 1) strength = 'observed';
    else if (weak.size > 0 || modelRepos.length > 0) strength = 'weak';

    const deterministic = solid.size > 0 || weak.size > 0;
    let source = 'none';
    if (deterministic) source = 'observed';
    else if (modelRepos.length > 0) source = 'model-inferred';

    const repos = [...new Set([...solid, ...weak, ...modelRepos])].sort(byName);
    const pushed = repos
      .map(name => repoByName.get(name)?.pushed_at)
      .filter(value => Number.isFinite(Date.parse(value)));
    const lastActivity = pushed.length
      ? pushed.reduce((best, value) => (Date.parse(value) > Date.parse(best) ? value : best))
      : null;

    return {
      id: category.id,
      label: category.label,
      strength,
      source,
      repoCount: repos.length,
      repos,
      technologies: members.map(technology => technology.id),
      modelEvidence: modelItems,
      lastActivity,
      // null when no push date is known: unknown recency is not "not recent".
      recent: lastActivity === null ? null : ageInDays(lastActivity, nowMs) <= RECENT_WITHIN_DAYS,
      note: categoryNote(strength, source, solid.size),
    };
  }).sort(bySignificance);

/**
 * Builds the skill evidence map from a profile's repositories.
 *
 * Only the user's own, non-fork repositories are considered; forks are counted in `notCounted`.
 * Evidence is deduplicated per repository and technology, keeping the strongest source
 * (manifest, topic, language, description), so a repository never counts twice for one
 * technology.
 *
 * @param {object} input
 * @param {object[]} input.repos  repositories as returned by `loadProfile`
 * @param {object[]} [input.repoAnalyses]  repository analyses (`scoreRepository` output); their
 *   top-level file names add `manifest` evidence
 * @param {Record<string, {value: string, state: string}>} [input.layaCategories]  Laya
 *   `skill_category` answers by repository full name; only confident answers are used
 * @param {{now: Date|number}} options
 * @returns {{categories: object[], technologies: object[], analyzed: {repos: number},
 *   notCounted: {forks: number}, caveats: string[]}}
 */
export const buildSkillEvidence = (
  { repos = [], repoAnalyses = [], layaCategories = {} } = {},
  { now } = {},
) => {
  const nowMs = toMs(now);
  const valid = repos.filter(repo => repo && typeof repoName(repo) === 'string');
  const own = valid.filter(repo => repo.fork !== true);
  const repoByName = new Map(own.map(repo => [repoName(repo), repo]));

  const byTechnology = collectEvidence(own, fileNamesBySubject(repoAnalyses));
  const technologies = buildTechnologies(byTechnology);
  const modelEvidence = collectModelEvidence(own, layaCategories);
  const categories = buildCategories(technologies, modelEvidence, repoByName, nowMs);

  const forks = valid.length - own.length;
  const caveats = [...BASE_CAVEATS];
  if (own.length === 0) caveats.push('No public non-fork repositories were available to analyze.');
  if (forks > 0) {
    caveats.push(
      `${plural(forks, 'fork')} not counted: forks mostly reflect the upstream project.`,
    );
  }
  if (repoAnalyses.length === 0) {
    caveats.push(
      'Repository file listings were not analyzed, so only languages, topics and descriptions were used.',
    );
  }
  if (categories.some(category => category.modelEvidence.length > 0)) {
    caveats.push(
      'Some evidence is a Laya model prediction; it is labelled and never counted as solid.',
    );
  }

  return {
    categories,
    technologies,
    analyzed: { repos: own.length },
    notCounted: { forks },
    caveats,
  };
};
