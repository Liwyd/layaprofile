// GitHub username rule: 1-39 alphanumeric characters or single hyphens,
// and the name cannot start or end with a hyphen.
const USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

// Repository names may contain ASCII letters, digits, ".", "-" and "_".
// "." and ".." are reserved and rejected.
const REPO_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export const isValidUsername = value => typeof value === 'string' && USERNAME_PATTERN.test(value);

export const isValidRepoName = value =>
  typeof value === 'string' && value !== '.' && value !== '..' && REPO_NAME_PATTERN.test(value);
