import { scoreProfile } from '../analysis/profileScore';

const USER_FIELDS = [
  'login',
  'name',
  'avatar_url',
  'html_url',
  'bio',
  'blog',
  'company',
  'location',
  'twitter_username',
  'public_repos',
  'followers',
  'following',
  'created_at',
  'updated_at',
  'type',
];

// `id` is required by the UI as a stable list key.
const REPO_FIELDS = [
  'id',
  'name',
  'full_name',
  'html_url',
  'description',
  'fork',
  'archived',
  'disabled',
  'language',
  'stargazers_count',
  'forks_count',
  'watchers_count',
  'open_issues_count',
  'size',
  'topics',
  'homepage',
  'default_branch',
  'created_at',
  'updated_at',
  'pushed_at',
  'has_issues',
  'has_wiki',
  'has_pages',
];

// Copies only fields that are present, so a field GitHub did not send stays absent
// instead of turning into a misleading default.
const pick = (source, fields) => {
  const picked = {};
  fields.forEach(field => {
    if (Object.hasOwn(source, field)) picked[field] = source[field];
  });
  return picked;
};

export const pickUser = user => pick(user, USER_FIELDS);

export const pickRepo = repo => {
  const picked = pick(repo, REPO_FIELDS);
  if (Object.hasOwn(repo, 'license')) {
    picked.license = repo.license
      ? { spdx_id: repo.license.spdx_id, name: repo.license.name }
      : repo.license;
  }
  return picked;
};

// ISO timestamps in the same format compare correctly as strings.
export const oldestOf = timestamps => timestamps.reduce((a, b) => (a < b ? a : b));

/**
 * Whether the account has a profile README, by GitHub's convention: a repository named like
 * the account (`<login>/<login>`) with a README. Returns `{ available }`, or undefined when it
 * cannot be determined (organizations use another convention, the repository list may have
 * been cut before the repository, or the README request failed).
 */
const findProfileReadme = async (client, user, repos, truncated) => {
  if (user.type === 'Organization' || typeof user.login !== 'string') return undefined;

  const login = user.login.toLowerCase();
  const profileRepo = repos.find(repo => repo.name.toLowerCase() === login);
  if (!profileRepo) return truncated ? undefined : { available: false };

  try {
    const readme = await client.getReadme(user.login, profileRepo.name);
    return { available: readme.data !== null };
  } catch (err) {
    console.warn(
      `Profile README check failed for ${user.login}: ${err?.code ?? 'UNKNOWN'} ${err?.message ?? err}`,
    );
    return undefined;
  }
};

/**
 * Loads a profile and its repositories in parallel and returns only the fields the app uses,
 * together with the profile score. `now` is injectable for deterministic tests.
 */
export const loadProfile = async (client, username, { now = Date.now() } = {}) => {
  const [userResult, reposResult] = await Promise.all([
    client.getUser(username),
    client.getRepos(username),
  ]);

  const user = pickUser(userResult.data);
  const repos = reposResult.data.map(pickRepo);
  const profileReadme = await findProfileReadme(client, user, repos, reposResult.truncated);

  return {
    user,
    repos,
    truncated: reposResult.truncated,
    profileReadme: profileReadme ?? null,
    profileScore: scoreProfile(
      { user, repos },
      { now, profileReadme, truncated: reposResult.truncated },
    ),
    fetchedAt: oldestOf([userResult.fetchedAt, reposResult.fetchedAt]),
    cached: userResult.cached && reposResult.cached,
    stale: userResult.stale || reposResult.stale,
    rateLimit: client.getRateLimit(),
  };
};
