// GitHub username rule: 1-39 alphanumeric characters or single hyphens,
// and the name cannot start or end with a hyphen.
const USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

// Repository names may contain ASCII letters, digits, ".", "-" and "_".
// "." and ".." are reserved and rejected.
const REPO_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export const isValidUsername = value => typeof value === 'string' && USERNAME_PATTERN.test(value);

export const isValidRepoName = value =>
  typeof value === 'string' && value !== '.' && value !== '..' && REPO_NAME_PATTERN.test(value);

const MAX_BRANCH_LENGTH = 255;
const CONTROL_OR_WHITESPACE = /[\s\p{Cc}]/u;

// Deliberately loose: it only rejects values that could not be a branch name or that would
// be unsafe inside a URL path. GitHub remains the authority on whether the branch exists.
export const isValidBranchName = value =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= MAX_BRANCH_LENGTH &&
  !value.startsWith('/') &&
  !value.includes('..') &&
  !CONTROL_OR_WHITESPACE.test(value);
