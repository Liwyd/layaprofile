// Shared fixtures for tests. Never imported by application code.

export const jsonResponse = (body, { status = 200, headers = {} } = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

export const textResponse = (text, { status = 200, headers = {} } = {}) =>
  new Response(text, { status, headers: { 'content-type': 'text/plain', ...headers } });

export const emptyResponse = (status, headers = {}) => new Response(null, { status, headers });

export const rateLimitHeaders = ({ limit = 60, remaining = 59, reset = 1_800_000_000 } = {}) => ({
  'x-ratelimit-limit': String(limit),
  'x-ratelimit-remaining': String(remaining),
  'x-ratelimit-reset': String(reset),
});

export const createClock = (start = 1_700_000_000_000) => {
  const clock = { time: start, now: () => clock.time };
  clock.advance = ms => {
    clock.time += ms;
  };
  return clock;
};

// A realistic subset of the GitHub user payload, including fields the app must drop.
export const fullUser = (overrides = {}) => ({
  login: 'octo',
  id: 1,
  node_id: 'MDQ6VXNlcjE=',
  avatar_url: 'https://avatars.githubusercontent.com/u/1',
  url: 'https://api.github.com/users/octo',
  html_url: 'https://github.com/octo',
  type: 'User',
  site_admin: false,
  name: 'Octo Cat',
  company: 'GitHub',
  blog: 'https://example.com',
  location: 'Internet',
  email: 'private@example.com',
  hireable: true,
  bio: 'Hello',
  twitter_username: 'octo',
  public_repos: 2,
  public_gists: 1,
  followers: 10,
  following: 3,
  created_at: '2011-01-25T18:44:36Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const fullRepo = (overrides = {}) => ({
  id: 10,
  node_id: 'R_1',
  name: 'hello',
  full_name: 'octo/hello',
  private: false,
  owner: { login: 'octo', id: 1 },
  html_url: 'https://github.com/octo/hello',
  description: 'A repo',
  fork: false,
  url: 'https://api.github.com/repos/octo/hello',
  clone_url: 'https://github.com/octo/hello.git',
  homepage: 'https://hello.example.com',
  size: 120,
  stargazers_count: 5,
  watchers_count: 5,
  language: 'JavaScript',
  has_issues: true,
  has_projects: true,
  has_downloads: true,
  has_wiki: false,
  has_pages: false,
  forks_count: 2,
  archived: false,
  disabled: false,
  open_issues_count: 1,
  license: { key: 'mit', name: 'MIT License', spdx_id: 'MIT', url: 'https://x', node_id: 'L_1' },
  topics: ['cli'],
  default_branch: 'main',
  created_at: '2020-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  pushed_at: '2024-01-03T00:00:00Z',
  ...overrides,
});
