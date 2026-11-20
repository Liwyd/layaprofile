import { plural } from './signals';

// Turns the skill evidence map and the quality analysis into a short list of practical next
// steps for a chosen role. The rules below are a fixed, transparent ruleset: they contain no
// courses, links, certifications or other external resources, and a step never claims more than
// the public evidence supports. "No public evidence found" is reported as exactly that, never as
// a lack of skill. See docs/SKILLS.md.

const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

// A foundation is a plain concept or technology a role builds on. `satisfiedBy` names what counts
// as public evidence of it: `technologies` (ids from technologies.js, any evidence at all) or
// `structure` (flags of the repository file listing, which need repository analyses).
const foundation = (id, label, satisfiedBy) => ({ id, label, satisfiedBy });
const withPriority = (definition, priority) => ({ ...definition, priority });

const HTTP_FRAMEWORK = foundation('http-framework', 'an HTTP framework', {
  technologies: ['django', 'flask', 'fastapi', 'express', 'spring-boot', 'nodejs'],
});
const RELATIONAL_DATABASE = foundation('relational-database', 'a relational database', {
  technologies: ['postgresql'],
});
const API_DESIGN = foundation('api-design', 'API design', {
  technologies: ['rest-api', 'graphql'],
});
const CONTAINERIZATION = foundation('containerization', 'containerization', {
  technologies: ['docker'],
});
const TESTING = foundation('testing', 'automated testing', { structure: ['tests'] });
const UI_FRAMEWORK = foundation('ui-framework', 'a UI framework', {
  technologies: ['react', 'nextjs', 'vue', 'angular', 'svelte'],
});
const TYPESCRIPT = foundation('typescript', 'TypeScript', { technologies: ['typescript'] });

const ROLE_DEFINITIONS = {
  backend: {
    label: 'Backend developer',
    core: ['backend'],
    foundations: [
      withPriority(HTTP_FRAMEWORK, 1),
      withPriority(RELATIONAL_DATABASE, 1),
      withPriority(API_DESIGN, 2),
      withPriority(CONTAINERIZATION, 2),
      withPriority(TESTING, 2),
    ],
    projectIdeas: [
      {
        id: 'rest-api-with-database',
        label: 'Build a small REST API backed by a relational database',
        when: { missing: ['http-framework', 'relational-database', 'api-design'] },
      },
      {
        id: 'containerize-a-service',
        label: 'Package one of your services in a container',
        when: { missing: ['containerization'] },
      },
    ],
    portfolio: [{ id: 'api-service', label: 'an API service', archetypes: ['api-service'] }],
  },
  frontend: {
    label: 'Frontend developer',
    core: ['frontend'],
    foundations: [
      withPriority(UI_FRAMEWORK, 1),
      withPriority(TYPESCRIPT, 2),
      withPriority(TESTING, 2),
    ],
    projectIdeas: [
      {
        id: 'interactive-web-app',
        label: 'Build an interactive web application with a UI framework',
        when: { missing: ['ui-framework'] },
      },
      {
        id: 'typed-port',
        label: 'Port one of your JavaScript projects to TypeScript',
        when: { missing: ['typescript'] },
      },
    ],
    portfolio: [{ id: 'web-application', label: 'a web application', archetypes: ['application'] }],
  },
  fullstack: {
    label: 'Full-stack developer',
    core: ['frontend', 'backend'],
    foundations: [
      withPriority(UI_FRAMEWORK, 1),
      withPriority(HTTP_FRAMEWORK, 1),
      withPriority(RELATIONAL_DATABASE, 2),
      withPriority(API_DESIGN, 2),
      withPriority(TESTING, 2),
      withPriority(CONTAINERIZATION, 3),
    ],
    projectIdeas: [
      {
        id: 'full-stack-app',
        label: 'Build a full-stack application: a UI, an API and a database',
        when: { missing: ['ui-framework', 'http-framework', 'relational-database'] },
      },
      {
        id: 'containerize-a-service',
        label: 'Package one of your services in a container',
        when: { missing: ['containerization'] },
      },
    ],
    portfolio: [
      { id: 'web-application', label: 'a web application', archetypes: ['application'] },
      { id: 'api-service', label: 'an API service', archetypes: ['api-service'] },
    ],
  },
  devops: {
    label: 'DevOps engineer',
    core: ['devops-infrastructure'],
    foundations: [
      withPriority(CONTAINERIZATION, 1),
      withPriority(
        foundation('infrastructure-as-code', 'infrastructure as code', {
          technologies: ['terraform', 'ansible'],
        }),
        1,
      ),
      withPriority(
        foundation('orchestration', 'container orchestration', { technologies: ['kubernetes'] }),
        2,
      ),
      withPriority(
        foundation('shell-scripting', 'shell scripting', { technologies: ['shell'] }),
        2,
      ),
      withPriority(
        foundation('continuous-integration', 'continuous integration', {
          structure: ['ci', 'possibleCi'],
        }),
        2,
      ),
    ],
    projectIdeas: [
      {
        id: 'environment-as-code',
        label: 'Describe a small environment as code',
        when: { missing: ['infrastructure-as-code'] },
      },
      {
        id: 'container-deployment',
        label: 'Containerize an application and run it on a cluster',
        when: { missing: ['containerization', 'orchestration'] },
      },
    ],
    portfolio: [
      {
        id: 'infrastructure-project',
        label: 'an infrastructure project',
        archetypes: ['infrastructure'],
      },
    ],
  },
  systems: {
    label: 'Systems developer',
    core: ['systems'],
    foundations: [
      withPriority(
        foundation('systems-language', 'a systems programming language', {
          technologies: ['rust', 'c', 'cpp', 'go'],
        }),
        1,
      ),
      withPriority(
        foundation('os-concepts', 'operating-system concepts', {
          technologies: ['linux-kernel', 'operating-system'],
        }),
        2,
      ),
      withPriority(TESTING, 2),
      withPriority(
        foundation('language-implementation', 'language implementation', {
          technologies: ['compiler'],
        }),
        3,
      ),
    ],
    projectIdeas: [
      {
        id: 'systems-cli',
        label: 'Write a command-line tool in a systems language',
        when: { missing: ['systems-language'] },
      },
      {
        id: 'toy-runtime',
        label: 'Build a small interpreter, shell or operating-system component',
        when: { missing: ['os-concepts', 'language-implementation'] },
      },
    ],
    portfolio: [
      { id: 'command-line-tool', label: 'a command-line tool', archetypes: ['cli-tool'] },
      { id: 'reusable-library', label: 'a reusable library', archetypes: ['library'] },
    ],
  },
  'data-engineering': {
    label: 'Data engineer',
    core: ['data-engineering'],
    foundations: [
      withPriority(
        foundation('data-processing', 'data-processing tools', {
          technologies: ['pandas', 'spark', 'etl'],
        }),
        1,
      ),
      withPriority(
        foundation('sql-database', 'a SQL database', { technologies: ['postgresql'] }),
        1,
      ),
      withPriority(
        foundation('workflow-orchestration', 'workflow orchestration', {
          technologies: ['airflow'],
        }),
        2,
      ),
      withPriority(TESTING, 2),
      withPriority(foundation('streaming', 'message streaming', { technologies: ['kafka'] }), 3),
    ],
    projectIdeas: [
      {
        id: 'etl-pipeline',
        label: 'Build a small ETL pipeline that loads data into a SQL database',
        when: { missing: ['data-processing', 'sql-database'] },
      },
      {
        id: 'scheduled-workflow',
        label: 'Run a pipeline on a schedule with a workflow orchestrator',
        when: { missing: ['workflow-orchestration'] },
      },
    ],
    portfolio: [
      {
        id: 'reusable-data-tool',
        label: 'a reusable data tool or library',
        archetypes: ['library', 'cli-tool'],
      },
    ],
  },
};

export const ROLES = deepFreeze(
  Object.fromEntries(
    Object.entries(ROLE_DEFINITIONS).map(([id, definition]) => [id, { id, ...definition }]),
  ),
);

export const ROLE_IDS = Object.freeze(Object.keys(ROLES));

export const isKnownRole = role => typeof role === 'string' && Object.hasOwn(ROLES, role);

export const MAX_STEPS = 8;
// Repository improvements are kept even when foundations fill the list.
export const RESERVED_IMPROVEMENTS = 2;
export const LIMITED_EVIDENCE_PREFIX = 'Based on limited public evidence: ';

// A gap is only reported with full confidence when enough repositories were inspected.
const MIN_REPOS_FOR_STRONG_GAP = 5;
const MIN_ANALYSES_FOR_STRONG_GAP = 3;
// Potential overall gain (see docs/SCORING.md) from which an improvement is a priority-2 step.
const HIGH_IMPACT = 5;
const MAX_BASED_ON = 5;
const MIN_PROFILE_COVERAGE = 0.5;

const SOLID = new Set(['observed', 'repeated']);
const STEP_STRENGTH_RANK = { none: 0, weak: 1, strong: 2 };

const ARCHETYPE_NAMES = {
  'api-service': 'an API service',
  application: 'an application',
  library: 'a library',
  'cli-tool': 'a command-line tool',
  infrastructure: 'an infrastructure project',
};

const lowerFirst = text =>
  /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
const sentence = text => text.trim().replace(/\.+$/, '');
const joinList = items =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
const repositories = count => plural(count, 'analyzed repository', 'analyzed repositories');
const sortedUnique = names => [...new Set(names)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

// Every rationale that rests on weak or missing evidence says so.
const rationale = (evidenceStrength, text) =>
  evidenceStrength === 'strong' ? text : `${LIMITED_EVIDENCE_PREFIX}${lowerFirst(text)}`;

// ---------------------------------------------------------------------------------------------
// Foundations
// ---------------------------------------------------------------------------------------------

// Where a foundation stands: 'satisfied' (observed or repeated evidence), 'weak' (only weak
// mentions), 'missing' (no public evidence found) or 'unknown' (it could not be assessed).
const evaluateFoundation = ({ satisfiedBy }, { technologyIndex, analyzedRepos, treeAnalyses }) => {
  if (satisfiedBy.structure) {
    if (treeAnalyses.length === 0) {
      return {
        status: 'unknown',
        repos: [],
        sampleSize: 0,
        reason: analyzedRepos === 0 ? 'no-repos' : 'no-analyses',
      };
    }
    const repos = treeAnalyses
      .filter(analysis =>
        satisfiedBy.structure.some(flag => (analysis.facts.structure[flag] ?? []).length > 0),
      )
      .map(analysis => analysis.subject);
    return {
      status: repos.length > 0 ? 'satisfied' : 'missing',
      repos: sortedUnique(repos),
      sampleSize: treeAnalyses.length,
    };
  }

  if (analyzedRepos === 0) {
    return { status: 'unknown', repos: [], sampleSize: 0, reason: 'no-repos' };
  }
  const found = satisfiedBy.technologies
    .map(id => technologyIndex.get(id))
    .filter(technology => technology !== undefined);
  const solid = found.filter(technology => SOLID.has(technology.strength));
  const used = solid.length > 0 ? solid : found;
  const repos = sortedUnique(
    used.flatMap(technology => technology.evidence.map(item => item.repo)),
  );
  let status = 'missing';
  if (solid.length > 0) status = 'satisfied';
  else if (found.length > 0) status = 'weak';
  return { status, repos, sampleSize: analyzedRepos };
};

const gapStrength = (definition, evaluation, coreCoverage) => {
  if (evaluation.status === 'unknown') return 'none';
  if (evaluation.status === 'weak') return 'weak';
  if (definition.satisfiedBy.structure) {
    return evaluation.sampleSize >= MIN_ANALYSES_FOR_STRONG_GAP ? 'strong' : 'weak';
  }
  const knownArea = coreCoverage === 'strong' || coreCoverage === 'partial';
  return evaluation.sampleSize >= MIN_REPOS_FOR_STRONG_GAP && knownArea ? 'strong' : 'weak';
};

const gapText = (definition, evaluation, roleLabel) => {
  const { label } = definition;
  switch (evaluation.status) {
    case 'weak':
      return `Only weak public evidence of ${label} was found (a language or description mention in ${joinList(evaluation.repos.slice(0, MAX_BASED_ON))}); it is a foundation of the ${roleLabel} path.`;
    case 'missing':
      return definition.satisfiedBy.structure
        ? `No sign of ${label} was found at the repository root of ${repositories(evaluation.sampleSize)}. Only top-level files are inspected, so this does not prove it is absent.`
        : `No public evidence of ${label} was found in ${repositories(evaluation.sampleSize)}; it is a foundation of the ${roleLabel} path.`;
    default:
      return evaluation.reason === 'no-repos'
        ? `No public non-fork repositories were available, so ${label} could not be assessed; it is a foundation of the ${roleLabel} path.`
        : `Repository file listings were not analyzed, so ${label} could not be assessed.`;
  }
};

// ---------------------------------------------------------------------------------------------
// Repository improvements: the text comes from the scoring rules, nothing is re-derived here.
// ---------------------------------------------------------------------------------------------

const isModelCheck = checkId => typeof checkId === 'string' && checkId.startsWith('laya-');

const improvementText = recommendation =>
  `${sentence(recommendation.evidence)}. ${recommendation.recommendation}`.replace(/^./, c =>
    c.toUpperCase(),
  );

const improvementPriority = impact => (impact >= HIGH_IMPACT ? 2 : 3);

const profileCandidates = profileScore => {
  const weakProfile =
    typeof profileScore?.coverage === 'number' && profileScore.coverage < MIN_PROFILE_COVERAGE;
  return (profileScore?.recommendations ?? [])
    .filter(item => typeof item?.recommendation === 'string')
    .map(item => {
      const evidenceStrength = weakProfile || isModelCheck(item.checkId) ? 'weak' : 'strong';
      return {
        impact: item.impact,
        step: {
          id: `repo-improvement:profile:${item.checkId}`,
          kind: 'repo-improvement',
          title: `Improve: ${item.label}`,
          rationale: rationale(evidenceStrength, improvementText(item)),
          evidenceStrength,
          basedOn: [item.checkId],
          priority: improvementPriority(item.impact),
        },
      };
    });
};

// The same check recommended for several repositories becomes one step. Its impact is the mean
// over the analyzed repositories, which keeps it on the scale of a single repository score.
const repositoryCandidates = repoAnalyses => {
  const groups = new Map();
  repoAnalyses.forEach(analysis => {
    (analysis?.recommendations ?? []).forEach(item => {
      if (typeof item?.recommendation !== 'string') return;
      const key = `${item.dimensionId}.${item.checkId}`;
      const group = groups.get(key) ?? { best: item, total: 0, repos: [] };
      group.total += item.impact;
      group.repos.push(analysis.subject);
      if (item.impact > group.best.impact) group.best = item;
      groups.set(key, group);
    });
  });
  return [...groups.values()].map(group => {
    const impact = group.total / repoAnalyses.length;
    const repos = sortedUnique(group.repos);
    const evidenceStrength = isModelCheck(group.best.checkId) ? 'weak' : 'strong';
    return {
      impact,
      step: {
        id: `repo-improvement:repo:${group.best.checkId}`,
        kind: 'repo-improvement',
        title: `Improve: ${group.best.label} (${plural(repos.length, 'repository', 'repositories')})`,
        rationale: rationale(evidenceStrength, improvementText(group.best)),
        evidenceStrength,
        basedOn: repos.slice(0, MAX_BASED_ON),
        priority: improvementPriority(impact),
      },
    };
  });
};

const topImprovements = (profileScore, repoAnalyses) =>
  [...profileCandidates(profileScore), ...repositoryCandidates(repoAnalyses)]
    .sort((a, b) => b.impact - a.impact)
    .slice(0, RESERVED_IMPROVEMENTS)
    .map(candidate => candidate.step);

// ---------------------------------------------------------------------------------------------
// Portfolio gaps
// ---------------------------------------------------------------------------------------------

const archetypeOf = analysis => {
  const archetype = analysis?.archetype ?? analysis?.archetypeHint;
  if (!archetype || archetype.archetype === 'unknown' || archetype.confidence === 'none') {
    return null;
  }
  return archetype.archetype;
};

const portfolioSteps = (ruleset, repoAnalyses) => {
  const inspected = repoAnalyses.filter(analysis => typeof analysis?.subject === 'string');
  if (inspected.length === 0) return [];
  const present = new Set(inspected.map(archetypeOf).filter(Boolean));
  const basedOn = sortedUnique(inspected.map(analysis => analysis.subject)).slice(0, MAX_BASED_ON);

  return ruleset.portfolio
    .filter(item => !item.archetypes.some(archetype => present.has(archetype)))
    .map(item => {
      // Project types are rule-based hints and model predictions, so a gap is never "strong".
      const evidenceStrength = 'weak';
      const names = joinList(item.archetypes.map(name => ARCHETYPE_NAMES[name] ?? name));
      return {
        id: `portfolio:${item.id}`,
        kind: 'portfolio',
        title: `Add to your portfolio: ${item.label}`,
        rationale: rationale(
          evidenceStrength,
          `None of the ${repositories(inspected.length)} was classified as ${names}. Project types are hints from rules and model predictions, so treat this as a prompt to review, not a verdict.`,
        ),
        evidenceStrength,
        basedOn,
        priority: 2,
      };
    });
};

// ---------------------------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------------------------

const coreCoverageOf = (core, categoryIndex, analyzedRepos) => {
  if (analyzedRepos === 0) return 'unknown';
  const strengths = core.map(id => categoryIndex.get(id)?.strength ?? 'unknown');
  if (strengths.every(strength => strength === 'repeated')) return 'strong';
  if (strengths.every(strength => strength === 'unknown')) return 'none';
  return 'partial';
};

// Array.prototype.sort is stable, so equal priorities keep their order of construction.
const byPriority = (a, b) => a.priority - b.priority;

/**
 * Builds the learning path for one role.
 *
 * @param {object} input
 * @param {object} input.skills  output of `buildSkillEvidence`
 * @param {object} [input.profileScore]  output of `scoreProfile`; its recommendations are reused
 * @param {object[]} [input.repoAnalyses]  repository analyses; they enable file-based foundations
 *   (tests, CI), portfolio gaps and repository-level improvements
 * @param {{role: string}} options  one of `ROLE_IDS`; anything else throws a `RangeError`
 * @returns {{role: string, roleLabel: string, summary: object, steps: object[]}} at most
 *   `MAX_STEPS` steps sorted by priority (1 is the most important)
 */
export const buildLearningPath = (
  { skills, profileScore, repoAnalyses = [] } = {},
  { role } = {},
) => {
  if (!isKnownRole(role)) {
    throw new RangeError(`Unknown role: ${String(role)}. Expected one of ${ROLE_IDS.join(', ')}.`);
  }
  if (!Array.isArray(skills?.categories) || !Array.isArray(skills?.technologies)) {
    throw new TypeError('`skills` must be the result of buildSkillEvidence.');
  }

  const ruleset = ROLES[role];
  const analyzedRepos = skills.analyzed?.repos ?? 0;
  const technologyIndex = new Map(skills.technologies.map(item => [item.id, item]));
  const categoryIndex = new Map(skills.categories.map(item => [item.id, item]));
  const treeAnalyses = repoAnalyses.filter(
    analysis => typeof analysis?.subject === 'string' && analysis.facts?.structure,
  );
  const coreCoverage = coreCoverageOf(ruleset.core, categoryIndex, analyzedRepos);
  const coreRepos = sortedUnique(
    ruleset.core.flatMap(id => categoryIndex.get(id)?.repos ?? []),
  ).slice(0, MAX_BASED_ON);

  const evaluations = ruleset.foundations.map(definition => ({
    definition,
    evaluation: evaluateFoundation(definition, { technologyIndex, analyzedRepos, treeAnalyses }),
  }));

  // Foundation steps.
  const foundationSteps = new Map();
  evaluations.forEach(({ definition, evaluation }) => {
    if (evaluation.status === 'satisfied') return;
    const evidenceStrength = gapStrength(definition, evaluation, coreCoverage);
    // A foundation that could not be assessed only because file listings are missing is a
    // reminder, not a finding about the user, so it ranks last.
    const reminder = evaluation.status === 'unknown' && analyzedRepos > 0;
    foundationSteps.set(definition.id, {
      id: `foundation:${definition.id}`,
      kind: 'foundation',
      title: `Gain hands-on experience with ${definition.label}`,
      rationale: rationale(evidenceStrength, gapText(definition, evaluation, ruleset.label)),
      evidenceStrength,
      basedOn: evaluation.status === 'weak' ? evaluation.repos.slice(0, MAX_BASED_ON) : coreRepos,
      priority: reminder ? 3 : definition.priority,
    });
  });

  // Project ideas, triggered by foundations with no or weak public evidence.
  const projectSteps = ruleset.projectIdeas.flatMap(idea => {
    const triggers = evaluations.filter(
      ({ definition, evaluation }) =>
        idea.when.missing.includes(definition.id) &&
        (evaluation.status === 'missing' || evaluation.status === 'weak'),
    );
    if (triggers.length === 0) return [];
    const evidenceStrength = triggers
      .map(({ definition }) => foundationSteps.get(definition.id).evidenceStrength)
      .reduce((a, b) => (STEP_STRENGTH_RANK[a] <= STEP_STRENGTH_RANK[b] ? a : b));
    return [
      {
        id: `project:${idea.id}`,
        kind: 'project',
        title: idea.label,
        rationale: rationale(
          evidenceStrength,
          `Practices ${joinList(triggers.map(({ definition }) => definition.label))}, where public evidence is missing or weak.`,
        ),
        evidenceStrength,
        basedOn: triggers.map(({ definition }) => definition.id),
        priority: 2,
      },
    ];
  });
  if (analyzedRepos === 0) {
    projectSteps.unshift({
      id: 'project:first-public-project',
      kind: 'project',
      title: `Publish a first public project for the ${ruleset.label} path`,
      rationale: rationale('none', 'No public non-fork repositories were available to analyze.'),
      evidenceStrength: 'none',
      basedOn: [],
      priority: 1,
    });
  }

  // At equal priority the order of construction decides: foundations first, then portfolio gaps
  // (observed in the profile), then project ideas (derived from the foundations).
  const others = [
    ...foundationSteps.values(),
    ...portfolioSteps(ruleset, repoAnalyses),
    ...projectSteps,
  ].sort(byPriority);
  const improvements = topImprovements(profileScore, repoAnalyses);
  const steps = [...others.slice(0, MAX_STEPS - improvements.length), ...improvements].sort(
    byPriority,
  );

  const notes = [
    'Steps come from a fixed ruleset for the role and from public evidence. They are suggestions, not an assessment of ability.',
  ];
  if (analyzedRepos === 0) notes.push('No public non-fork repositories were available to analyze.');
  if (treeAnalyses.length === 0) {
    notes.push(
      'Repository file listings were not analyzed: file-based foundations could not be assessed and portfolio gaps were not checked.',
    );
  }
  if (ruleset.core.some(id => categoryIndex.get(id)?.source === 'model-inferred')) {
    notes.push('Some evidence for the core areas is a model prediction and is not verified.');
  }

  return {
    role,
    roleLabel: ruleset.label,
    summary: {
      coreCoverage,
      coreCategories: ruleset.core.map(id => ({
        id,
        label: categoryIndex.get(id)?.label ?? id,
        strength: categoryIndex.get(id)?.strength ?? 'unknown',
      })),
      foundations: evaluations.map(({ definition, evaluation }) => ({
        id: definition.id,
        label: definition.label,
        status: evaluation.status,
        basedOn:
          evaluation.status === 'satisfied' || evaluation.status === 'weak'
            ? evaluation.repos.slice(0, MAX_BASED_ON)
            : [],
      })),
      notes,
    },
    steps,
  };
};
