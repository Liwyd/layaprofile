import { ageInDays, hasText, licenseState, roundTo, toMs } from './signals';

// Puts two profiles side by side and reports where they differ. It is deliberately not a
// ranking: there is no winner, no overall comparison score and no weighting of the rows.
// Popularity rows (stars, forks, followers) are marked as such and never enter the list of
// differences. See docs/SKILLS.md.

export const ACTIVE_WITHIN_DAYS = 365;
export const TOP_LANGUAGES_PER_SIDE = 8;
// A row appears in `differences` when its normalized gap is at least this large (0-1).
export const MIN_DIFFERENCE = 0.2;
export const MAX_DIFFERENCES = 4;

const SOLID = new Set(['observed', 'repeated']);
const DAYS_PER_YEAR = 365.25;

const CAVEATS = [
  'Stars, forks and followers measure attention, not quality, and are never used in the differences.',
  'Profile scores are completeness checklists, not a ranking of developers.',
  'Counts cover public, non-fork repositories only. Private work and activity elsewhere are not visible.',
  'Languages are the primary language GitHub reports per repository, shown as repository counts, not skill levels.',
];

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const ownRepos = side =>
  (Array.isArray(side?.repos) ? side.repos : []).filter(r => r?.fork !== true);

// Sum of a numeric field. Null when repositories exist but none of them reported the field:
// unknown is not zero.
const sumOf = (repos, field) => {
  const values = repos.map(repo => repo[field]).filter(Number.isFinite);
  if (repos.length > 0 && values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0);
};

// How many repositories satisfy `test`, out of those where it can be decided (`test` returns
// null for a field GitHub did not send). `null` when none can be decided.
const shareOf = (repos, test) => {
  const decided = repos.map(test).filter(value => value !== null);
  if (decided.length === 0) return null;
  return { count: decided.filter(Boolean).length, of: decided.length };
};

const summarize = (side, nowMs) => {
  const repos = ownRepos(side);
  const profileScore = side?.profileScore ?? {};
  const created = Date.parse(side?.user?.created_at);
  return {
    login: side?.user?.login ?? null,
    name: side?.user?.name ?? null,
    repos,
    truncated: side?.truncated === true,
    publicRepos: repos.length,
    stars: sumOf(repos, 'stargazers_count'),
    forks: sumOf(repos, 'forks_count'),
    followers: Number.isFinite(side?.user?.followers) ? side.user.followers : null,
    score: Number.isFinite(profileScore.score) ? profileScore.score : null,
    label: profileScore.label ?? null,
    coverage: Number.isFinite(profileScore.coverage) ? profileScore.coverage : null,
    description: shareOf(repos, repo =>
      repo.description === undefined ? null : hasText(repo.description),
    ),
    license: shareOf(repos, repo => {
      const state = licenseState(repo);
      return state === 'unknown' ? null : state === 'recognized';
    }),
    topics: shareOf(repos, repo => (Array.isArray(repo.topics) ? repo.topics.length > 0 : null)),
    recent: shareOf(repos, repo => {
      const days = ageInDays(repo.pushed_at, nowMs);
      return days === null ? null : days <= ACTIVE_WITHIN_DAYS;
    }),
    accountYears: Number.isFinite(created)
      ? roundTo(Math.max(0, (nowMs - created) / (86_400_000 * DAYS_PER_YEAR)), 1)
      : null,
    skills: Array.isArray(side?.skills?.categories) ? side.skills.categories : [],
  };
};

// ---------------------------------------------------------------------------------------------
// Metric rows
// ---------------------------------------------------------------------------------------------

const row = (id, label, a, b, { unit, note, popularity = false, aOf, bOf } = {}) => {
  const metric = { id, label, a, b, unit, note, popularity };
  if (aOf !== undefined) metric.aOf = aOf;
  if (bOf !== undefined) metric.bOf = bOf;
  return metric;
};

const shareRow = (id, label, key, a, b, note) =>
  row(id, label, a[key]?.count ?? null, b[key]?.count ?? null, {
    unit: 'repositories',
    note,
    aOf: a[key]?.of ?? null,
    bOf: b[key]?.of ?? null,
  });

const buildMetrics = (a, b) => [
  row('public-repos', 'Public repositories', a.publicRepos, b.publicRepos, {
    unit: 'repositories',
    note: 'Own, non-fork repositories only.',
  }),
  row('stars', 'Stars (popularity, not quality)', a.stars, b.stars, {
    unit: 'stars',
    note: 'Popularity: stars measure attention, not quality.',
    popularity: true,
  }),
  row('forks', 'Forks received (popularity, not quality)', a.forks, b.forks, {
    unit: 'forks',
    note: 'Popularity: forks measure attention, not quality.',
    popularity: true,
  }),
  row('followers', 'Followers (popularity, not quality)', a.followers, b.followers, {
    unit: 'followers',
    note: 'Popularity: followers measure attention, not quality.',
    popularity: true,
  }),
  row('profile-score', 'Profile checklist score', a.score, b.score, {
    unit: 'points of 100',
    note: 'A completeness checklist of public profile data, not a ranking.',
  }),
  row('profile-label', 'Profile checklist label', a.label, b.label, {
    unit: 'label',
    note: 'Derived from the score and the share of the checklist that could be assessed.',
  }),
  row('profile-coverage', 'Profile evidence coverage', a.coverage, b.coverage, {
    unit: 'share of the checklist assessed (0-1)',
    note: 'How much of the checklist could be assessed; separate from the score.',
  }),
  shareRow(
    'with-description',
    'Repositories with a description',
    'description',
    a,
    b,
    'Counted among repositories where GitHub reported the field.',
  ),
  shareRow(
    'with-license',
    'Repositories with a recognized license',
    'license',
    a,
    b,
    'A license file GitHub could not identify is not counted.',
  ),
  shareRow(
    'with-topics',
    'Repositories with topics',
    'topics',
    a,
    b,
    'Counted among repositories where GitHub reported the field.',
  ),
  shareRow(
    'recently-pushed',
    `Repositories pushed in the last ${ACTIVE_WITHIN_DAYS} days`,
    'recent',
    a,
    b,
    'The last push date, not commit history.',
  ),
  row('account-age', 'Account age', a.accountYears, b.accountYears, {
    unit: 'years',
    note: 'Time since the account was created.',
  }),
];

// ---------------------------------------------------------------------------------------------
// Languages, skills, activity
// ---------------------------------------------------------------------------------------------

const languageCounts = repos => {
  const counts = new Map();
  repos.forEach(repo => {
    if (hasText(repo.language)) counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  });
  return counts;
};

const topLanguages = counts =>
  [...counts.entries()]
    .sort((x, y) => y[1] - x[1] || byName(x[0], y[0]))
    .slice(0, TOP_LANGUAGES_PER_SIDE)
    .map(([language]) => language);

const buildLanguages = (a, b) => {
  const countsA = languageCounts(a.repos);
  const countsB = languageCounts(b.repos);
  const union = new Set([...topLanguages(countsA), ...topLanguages(countsB)]);
  return [...union]
    .map(language => {
      const inA = countsA.get(language) ?? 0;
      const inB = countsB.get(language) ?? 0;
      let relation = 'shared';
      if (inB === 0) relation = 'only-a';
      else if (inA === 0) relation = 'only-b';
      return { language, a: inA, b: inB, relation };
    })
    .sort((x, y) => y.a + y.b - (x.a + x.b) || byName(x.language, y.language));
};

const buildSkills = (a, b) => {
  const strengthOf = (side, id) => side.skills.find(category => category.id === id)?.strength;
  const ids = [...new Set([...a.skills, ...b.skills].map(category => category.id))];
  const entries = ids.map(id => {
    const category = [...a.skills, ...b.skills].find(item => item.id === id);
    return {
      id,
      label: category.label,
      a: strengthOf(a, id) ?? 'unknown',
      b: strengthOf(b, id) ?? 'unknown',
    };
  });
  const solid = strength => SOLID.has(strength);
  return {
    overlap: entries.filter(entry => solid(entry.a) && solid(entry.b)),
    distinctiveToA: entries.filter(entry => solid(entry.a) && !solid(entry.b)),
    distinctiveToB: entries.filter(entry => !solid(entry.a) && solid(entry.b)),
    unknownInBoth: entries.filter(entry => entry.a === 'unknown' && entry.b === 'unknown'),
    note: 'Based on public repository evidence, not a measure of expertise. "Distinctive" means evidence was observed on one side only; the other side may simply have no public evidence.',
  };
};

const yearOf = timestamp => {
  const time = Date.parse(timestamp);
  return Number.isFinite(time) ? new Date(time).getUTCFullYear() : null;
};

const countByYear = (repos, field) => {
  const counts = new Map();
  repos.forEach(repo => {
    const year = yearOf(repo[field]);
    if (year !== null) counts.set(year, (counts.get(year) ?? 0) + 1);
  });
  return counts;
};

const buildActivity = (a, b) => {
  const created = [countByYear(a.repos, 'created_at'), countByYear(b.repos, 'created_at')];
  const pushed = [countByYear(a.repos, 'pushed_at'), countByYear(b.repos, 'pushed_at')];
  const years = [...created, ...pushed].flatMap(counts => [...counts.keys()]);
  const range = [];
  if (years.length > 0) {
    for (let year = Math.min(...years); year <= Math.max(...years); year += 1) range.push(year);
  }
  return {
    label: 'Repository creation and last-push years',
    note: 'These are repository creation and last-push dates, not commit history.',
    years: range.map(year => ({
      year,
      created: { a: created[0].get(year) ?? 0, b: created[1].get(year) ?? 0 },
      pushed: { a: pushed[0].get(year) ?? 0, b: pushed[1].get(year) ?? 0 },
    })),
  };
};

// ---------------------------------------------------------------------------------------------
// Differences
// ---------------------------------------------------------------------------------------------

// How each row is turned into a neutral sentence. Popularity rows and rows that are not
// comparable on their own (label, coverage, account age) are left out on purpose.
const DIFFERENCE_RULES = {
  'public-repos': { kind: 'count', noun: 'public repositories' },
  'profile-score': { kind: 'score', noun: 'profile checklist score' },
  'with-description': { kind: 'share', noun: 'repositories with a description' },
  'with-license': { kind: 'share', noun: 'repositories with a recognized license' },
  'with-topics': { kind: 'share', noun: 'repositories with topics' },
  'recently-pushed': {
    kind: 'share',
    noun: `repositories pushed in the last ${ACTIVE_WITHIN_DAYS} days`,
  },
};

const buildDifferences = (metrics, a, b) => {
  const candidates = [];
  metrics.forEach(metric => {
    const rule = DIFFERENCE_RULES[metric.id];
    if (!rule || metric.popularity || metric.a === null || metric.b === null) return;

    let magnitude;
    if (rule.kind === 'share') {
      if (!metric.aOf || !metric.bOf) return;
      magnitude = Math.abs(metric.a / metric.aOf - metric.b / metric.bOf);
    } else if (rule.kind === 'score') {
      magnitude = Math.abs(metric.a - metric.b) / 100;
    } else {
      const largest = Math.max(metric.a, metric.b);
      magnitude = largest === 0 ? 0 : Math.abs(metric.a - metric.b) / largest;
    }
    if (magnitude < MIN_DIFFERENCE) return;

    const larger = (
      rule.kind === 'share' ? metric.a / metric.aOf > metric.b / metric.bOf : metric.a > metric.b
    )
      ? 'a'
      : 'b';
    const big = larger === 'a' ? a : b;
    const format = (value, of) => (rule.kind === 'share' ? `${value}/${of}` : String(value));
    const bigText = format(metric[larger], metric[`${larger}Of`]);
    const smallSide = larger === 'a' ? 'b' : 'a';
    const smallText = format(metric[smallSide], metric[`${smallSide}Of`]);
    const who = big.login ?? (larger === 'a' ? 'A' : 'B');
    const phrase = rule.kind === 'score' ? `a higher ${rule.noun}` : `more ${rule.noun}`;
    candidates.push({
      id: metric.id,
      label: metric.label,
      larger,
      magnitude: roundTo(magnitude, 2),
      text: `${who} has ${phrase} (${bigText} vs ${smallText}${rule.kind === 'score' ? ' points' : ''})`,
    });
  });
  return candidates
    .sort((x, y) => y.magnitude - x.magnitude || byName(x.id, y.id))
    .slice(0, MAX_DIFFERENCES);
};

/**
 * Compares two profiles side by side. Each side is `{ user, repos, profileScore, skills }`
 * (the output of `loadProfile`). The result is symmetric: swapping the arguments mirrors it.
 *
 * @param {object} a
 * @param {object} b
 * @param {{now?: Date|number}} [options]  the clock; defaults to the current time
 * @returns {{users, metrics, languages, skills, activity, differences, caveats}}
 *   no field names a winner or ranks the two profiles
 */
export const compareProfiles = (a, b, { now = Date.now() } = {}) => {
  const nowMs = toMs(now);
  const sideA = summarize(a, nowMs);
  const sideB = summarize(b, nowMs);
  const metrics = buildMetrics(sideA, sideB);

  // Sorted, so that swapping the two sides gives the same list.
  const extra = [];
  [sideA, sideB].forEach(side => {
    if (side.truncated) {
      extra.push(
        `${side.login ?? 'One account'} has more repositories than were loaded; counts use the most recently pushed ones.`,
      );
    }
  });
  if (sideA.publicRepos === 0 || sideB.publicRepos === 0) {
    extra.push(
      'At least one account has no public non-fork repositories: repository-based rows are empty, not negative.',
    );
  }
  const caveats = [...CAVEATS, ...extra.sort(byName)];

  return {
    users: {
      a: { login: sideA.login, name: sideA.name },
      b: { login: sideB.login, name: sideB.name },
    },
    metrics,
    languages: buildLanguages(sideA, sideB),
    skills: buildSkills(sideA, sideB),
    activity: buildActivity(sideA, sideB),
    differences: buildDifferences(metrics, sideA, sideB),
    caveats,
  };
};
