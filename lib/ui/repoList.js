// Pure helpers behind the repository list and the activity lists. None of them mutates its input.

export const REPO_SORTS = Object.freeze([
  { id: 'pushed', label: 'Last push' },
  { id: 'stars', label: 'Stars' },
  { id: 'name', label: 'Name' },
]);

export const REPO_FILTERS = Object.freeze([
  { id: 'own', label: 'Own' },
  { id: 'forks', label: 'Forks' },
  { id: 'all', label: 'All' },
]);

export const isOwnRepo = repo => repo?.fork !== true;

/** Repository counts for the overview strip: `{ total, own, forks }`. */
export const countRepos = repos => {
  const list = Array.isArray(repos) ? repos : [];
  const own = list.filter(isOwnRepo).length;
  return { total: list.length, own, forks: list.length - own };
};

// Unparseable or missing dates sort as the oldest possible push.
const pushedTime = repo => {
  const time = Date.parse(repo.pushed_at);
  return Number.isFinite(time) ? time : -Infinity;
};

const stars = repo => (Number.isFinite(repo.stargazers_count) ? repo.stargazers_count : 0);

const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

// Every ordering ends with the name, so the result never depends on the input order.
const COMPARATORS = {
  pushed: (a, b) => pushedTime(b) - pushedTime(a) || byName(a, b),
  stars: (a, b) => stars(b) - stars(a) || pushedTime(b) - pushedTime(a) || byName(a, b),
  name: byName,
};

// `-Infinity - -Infinity` is NaN, which `||` treats as "equal", so those ties fall through to
// the next comparison.
export const sortRepos = (repos, sort = 'pushed') => {
  const compare = COMPARATORS[sort];
  if (!compare) throw new RangeError(`Unknown repository sort: ${String(sort)}`);
  return [...repos].sort(compare);
};

export const filterRepos = (repos, filter = 'own') => {
  switch (filter) {
    case 'own':
      return repos.filter(isOwnRepo);
    case 'forks':
      return repos.filter(repo => !isOwnRepo(repo));
    case 'all':
      return [...repos];
    default:
      throw new RangeError(`Unknown repository filter: ${String(filter)}`);
  }
};

export const viewRepos = (repos, { filter = 'own', sort = 'pushed' } = {}) =>
  sortRepos(filterRepos(Array.isArray(repos) ? repos : [], filter), sort);

/** The `limit` most recently pushed own repositories. */
export const recentlyPushed = (repos, limit = 5) =>
  viewRepos(repos, { filter: 'own' }).slice(0, limit);

/** The `limit` own repositories with the most stars. Repositories without stars are left out. */
export const mostStarred = (repos, limit = 5) =>
  viewRepos(repos, { filter: 'own', sort: 'stars' })
    .filter(repo => stars(repo) > 0)
    .slice(0, limit);
