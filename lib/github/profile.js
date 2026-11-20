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

/** Loads a profile and its repositories in parallel and returns only the fields the app uses. */
export const loadProfile = async (client, username) => {
  const [userResult, reposResult] = await Promise.all([
    client.getUser(username),
    client.getRepos(username),
  ]);

  return {
    user: pickUser(userResult.data),
    repos: reposResult.data.map(pickRepo),
    truncated: reposResult.truncated,
    fetchedAt: oldestOf([userResult.fetchedAt, reposResult.fetchedAt]),
    cached: userResult.cached && reposResult.cached,
    stale: userResult.stale || reposResult.stale,
    rateLimit: client.getRateLimit(),
  };
};
