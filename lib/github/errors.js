// Typed errors for everything between our server and the GitHub API.
// `status` is the HTTP status our own API routes answer with for each code.
const STATUS_BY_CODE = {
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UPSTREAM: 502,
  NETWORK: 502,
  TIMEOUT: 504,
  INVALID_INPUT: 400,
  BAD_RESPONSE: 502,
};

export const ERROR_CODES = Object.freeze(Object.keys(STATUS_BY_CODE));

export class GitHubError extends Error {
  /**
   * @param {keyof typeof STATUS_BY_CODE} code
   * @param {string} message Safe to show to API consumers; never include secrets here.
   * @param {{ resetAt?: string, cause?: unknown, which?: 'a'|'b' }} [options]
   *   `which` names the side of a two-user request (the compare route) the error is about.
   */
  constructor(code, message, { resetAt, cause, which } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    if (!Object.hasOwn(STATUS_BY_CODE, code)) {
      throw new TypeError(`Unknown GitHubError code: ${code}`);
    }
    this.name = 'GitHubError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    if (resetAt) this.resetAt = resetAt;
    if (which) this.which = which;
  }
}

/** HTTP status an API route should answer with for `err` (500 for anything unexpected). */
export const statusFor = err => (err instanceof GitHubError ? err.status : 500);

/**
 * Serializable error body for API responses. Unknown errors are reduced to a generic
 * message so internal details and stack traces never reach the client.
 */
export const toErrorBody = err => {
  if (err instanceof GitHubError) {
    const body = { code: err.code, message: err.message };
    if (err.resetAt) body.resetAt = err.resetAt;
    if (err.which) body.which = err.which;
    return { error: body };
  }
  return { error: { code: 'INTERNAL', message: 'An unexpected error occurred.' } };
};
