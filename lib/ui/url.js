import { isValidRepoName, isValidUsername } from '../validation';

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * A link target for a user-supplied address (a profile "website" field): only http and https are
 * allowed, and a bare host such as "example.com" gets https. Anything else (javascript:, data:,
 * garbage) returns null, and the caller shows the text without a link.
 */
export const safeHttpUrl = value => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  try {
    const url = new URL(HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    // An unparseable address is simply not linked.
    return null;
  }
};

/** The GitHub page of a repository from its full name ("owner/name"), or null if malformed. */
export const repoUrl = fullName => {
  if (typeof fullName !== 'string') return null;
  const [owner, name, ...rest] = fullName.split('/');
  return rest.length === 0 && isValidUsername(owner) && isValidRepoName(name)
    ? `https://github.com/${owner}/${name}`
    : null;
};
