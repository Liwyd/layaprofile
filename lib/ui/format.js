// Display formatting and plain-language labels for the report. Pure: dates take an explicit
// clock or time zone so the output is deterministic in tests.

const LOCALE = 'en-US';
const MS_PER_DAY = 86_400_000;

export const EM_DASH = '—';

const timeOf = value => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

const trimNumber = value => String(Math.round(value * 10) / 10);

export const formatCount = value =>
  Number.isFinite(value) ? value.toLocaleString(LOCALE) : EM_DASH;

/** "Nov 21, 2026", or null when the date cannot be parsed. Calendar dates are shown in UTC. */
export const formatDate = (value, { timeZone = 'UTC' } = {}) => {
  const time = timeOf(value);
  return time === null
    ? null
    : new Date(time).toLocaleDateString(LOCALE, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone,
      });
};

/** "Nov 21, 2026, 2:05 PM" in the viewer's time zone (or `timeZone`); null when unparseable. */
export const formatDateTime = (value, { timeZone } = {}) => {
  const time = timeOf(value);
  return time === null
    ? null
    : new Date(time).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short', timeZone });
};

/** "2:05 PM" in the viewer's time zone (or `timeZone`); null when unparseable. */
export const formatTime = (value, { timeZone } = {}) => {
  const time = timeOf(value);
  return time === null
    ? null
    : new Date(time).toLocaleTimeString(LOCALE, { timeStyle: 'short', timeZone });
};

/** Compact age such as "today", "12 d ago", "5 mo ago" or "3 y ago"; null when unparseable. */
export const formatAge = (value, now) => {
  const time = timeOf(value);
  if (time === null) return null;
  const days = Math.max(0, Math.floor((now - time) / MS_PER_DAY));
  if (days < 1) return 'today';
  if (days < 30) return `${days} d ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} y ago`;
};

/**
 * "3.5/4"; an unknown value (null points) is "\u2014/4", never "0/4". A check with no points
 * to earn (`max` 0) is informational and shows "info".
 */
export const formatPoints = (points, max) => {
  if (!(max > 0)) return 'info';
  return `${Number.isFinite(points) ? trimNumber(points) : EM_DASH}/${trimNumber(max)}`;
};

export const formatScore = score => (Number.isFinite(score) ? String(score) : EM_DASH);

/** Coverage (0-1) as a percentage. */
export const formatCoverage = coverage =>
  Number.isFinite(coverage) ? `${Math.round(coverage * 100)}%` : EM_DASH;

/** Potential overall gain of a recommendation, e.g. "+2.5 pts". */
export const formatImpact = impact =>
  Number.isFinite(impact) ? `+${(Math.round(impact * 10) / 10).toFixed(1)} pts` : EM_DASH;

export const formatProbability = value => (Number.isFinite(value) ? `p=${value.toFixed(2)}` : null);

/** Whether the profile data was fetched live, served from the cache, or is a stale fallback. */
export const fetchState = ({ stale, cached } = {}) => {
  if (stale === true) return 'stale';
  return cached === true ? 'cached' : 'live';
};

// ---------------------------------------------------------------------------------------------
// Evidence status of a check (see docs/SCORING.md)
// ---------------------------------------------------------------------------------------------

const STATUS_INFO = {
  verified: { label: 'verified', hint: 'An observed fact.' },
  rule: { label: 'rule', hint: 'A deterministic rule applied to what was inspected.' },
  model: { label: 'model', hint: 'A Laya prediction. It is not a verified fact.' },
  unknown: { label: 'unknown', hint: 'The data is unavailable. It is excluded from the score.' },
};

/** Label and hint for a check status; anything unrecognized is shown as unknown. */
export const statusInfo = status => STATUS_INFO[status] ?? STATUS_INFO.unknown;

// ---------------------------------------------------------------------------------------------
// Skill evidence (see docs/SKILLS.md)
// ---------------------------------------------------------------------------------------------

const STRENGTH_LABELS = {
  repeated: 'repeated',
  observed: 'observed',
  weak: 'weak',
  unknown: 'no public evidence',
};

export const strengthLabel = strength => STRENGTH_LABELS[strength] ?? STRENGTH_LABELS.unknown;

const SOURCE_LABELS = {
  manifest: 'manifest',
  topic: 'topic',
  language: 'language',
  description: 'description',
  model: 'model',
};

export const sourceLabel = source => SOURCE_LABELS[source] ?? String(source);

const STEP_KIND_LABELS = {
  foundation: 'foundation',
  project: 'project',
  portfolio: 'portfolio',
  'repo-improvement': 'improvement',
};

export const stepKindLabel = kind => STEP_KIND_LABELS[kind] ?? String(kind);

const FOUNDATION_STATUS_LABELS = {
  satisfied: 'evidence found',
  weak: 'weak evidence',
  missing: 'no public evidence',
  unknown: 'not assessed',
};

export const foundationStatusLabel = status =>
  FOUNDATION_STATUS_LABELS[status] ?? FOUNDATION_STATUS_LABELS.unknown;

const STEP_STRENGTH_LABELS = {
  strong: 'strong evidence',
  weak: 'weak evidence',
  none: 'no evidence',
};

export const stepStrengthLabel = strength => STEP_STRENGTH_LABELS[strength] ?? 'no evidence';

// ---------------------------------------------------------------------------------------------
// Repository archetype
// ---------------------------------------------------------------------------------------------

const ARCHETYPE_LABELS = {
  'cli-tool': 'Command-line tool',
  'api-service': 'API service',
  infrastructure: 'Infrastructure tool',
  'learning-project': 'Learning project',
  documentation: 'Documentation',
  'config-dotfiles': 'Configuration or dotfiles',
  framework: 'Framework',
  library: 'Library',
  application: 'Application',
  unknown: 'Not determined',
};

export const archetypeLabel = archetype => ARCHETYPE_LABELS[archetype] ?? String(archetype);

// ---------------------------------------------------------------------------------------------
// Laya (the local model). Plain-language explanations of every state.
// ---------------------------------------------------------------------------------------------

const LAYA_STATES = {
  ok: {
    key: 'ok',
    text: 'Laya answered. A prediction is used only when its probability reaches the question threshold.',
  },
  partial: {
    key: 'partial',
    text: 'Laya answered some questions; others could not be asked. A missing answer is unknown, not negative.',
  },
  uncertain: {
    key: 'uncertain',
    text: 'Laya ran but was not confident enough to give a usable answer, so none of its predictions were used.',
  },
  unavailable: {
    key: 'unavailable',
    text: 'The local Laya server could not be reached or failed. The score uses deterministic rules only.',
  },
  disabled: {
    key: 'disabled',
    text: 'Laya is not enabled on this server. The score uses deterministic rules only.',
  },
  skipped: {
    key: 'skipped',
    text: 'Laya does not assess forks.',
  },
};

/**
 * The overall state of a Laya assessment (`laya` of the analysis API) in plain words:
 * `{ key, text }` with key ok, partial, uncertain, unavailable, disabled or skipped.
 * "uncertain" means the model ran but no answer passed its threshold.
 */
export const layaSummary = laya => {
  const status = laya?.status;
  if (status === 'ok' || status === 'partial') {
    const answers = Object.values(laya.answers ?? {});
    if (answers.length > 0 && !answers.some(answer => answer?.state === 'confident')) {
      return LAYA_STATES.uncertain;
    }
    return LAYA_STATES[status];
  }
  return LAYA_STATES[status] ?? LAYA_STATES.unavailable;
};

const QUESTION_TITLES = {
  readme_sufficient: 'README explains the project and how to start',
  install_clarity: 'Installation instructions',
  usage_examples: 'Usage examples',
  docs_completeness: 'Documentation completeness',
  archetype: 'Project type',
  skill_category: 'Skill category',
};

const UNCERTAIN_REASONS = {
  'below-threshold': 'probability below the threshold',
  abstained: 'the model abstained',
  unevaluated: 'the model could not evaluate the question',
  'no-confidence': 'no probability was returned',
};

/**
 * Display data for one Laya answer: `{ id, question, state, value, probability, threshold,
 * reason }`. An uncertain answer has no value.
 */
export const layaAnswerView = (id, answer) => {
  const confident = answer?.state === 'confident';
  let value = null;
  if (confident) {
    value =
      id === 'archetype' ? archetypeLabel(answer.value) : String(answer.label ?? answer.value);
  }
  return {
    id,
    question: QUESTION_TITLES[id] ?? id,
    state: confident ? 'confident' : 'uncertain',
    value,
    probability: formatProbability(answer?.answerConfidence),
    threshold: Number.isFinite(answer?.threshold) ? answer.threshold.toFixed(2) : null,
    reason: confident ? null : (UNCERTAIN_REASONS[answer?.reason] ?? 'no usable answer'),
  };
};
