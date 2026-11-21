// Browser-side access to LayaProfile's own API (GitHub is never called from the browser).
// Every route answers with `{ error: { code, message, resetAt? } }` on failure.

import { formatTime } from './format';

export class ApiError extends Error {
  constructor({ status, code, message, resetAt } = {}) {
    super(message || `The API responded with status ${status ?? 'unknown'}.`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.resetAt = resetAt;
  }
}

/**
 * GET `url` and parse the JSON body. Failures become an `ApiError`: a failed request is code
 * `NETWORK`, an HTTP error carries the code and message of our error body, and a body that
 * `validate` rejects is `BAD_RESPONSE`. An aborted request rethrows the original abort error so
 * callers can ignore it.
 */
export const getJson = async (url, { signal, validate, fetchImpl } = {}) => {
  const doFetch = fetchImpl ?? globalThis.fetch;
  let response;
  try {
    response = await doFetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError({ code: 'NETWORK', message: 'The request could not be completed.' });
  }

  let body = null;
  try {
    body = await response.json();
  } catch (err) {
    if (signal?.aborted) throw err;
    // A non-JSON body (for example a proxy error page) is handled through the status below.
    console.error('The API returned a non-JSON body:', err);
  }

  if (!response.ok) {
    const error = body?.error ?? {};
    throw new ApiError({
      status: response.status,
      code: error.code,
      message: error.message,
      resetAt: error.resetAt,
    });
  }
  if (validate && !validate(body)) {
    throw new ApiError({
      status: response.status,
      code: 'BAD_RESPONSE',
      message: 'The API returned an unexpected response.',
    });
  }
  return body;
};

const path = value => encodeURIComponent(value);

export const profileUrl = username => `/api/profile/${path(username)}`;
export const analysisUrl = (username, repo) =>
  `/api/repos/${path(username)}/${path(repo)}/analysis`;
export const learningPathUrl = (username, role) =>
  `/api/learning-path/${path(username)}?role=${path(role)}`;

// Only the user and the repositories are required: the score and skill sections are optional and
// show their own error state when their part of the payload is missing.
export const isProfileResponse = body => Boolean(body?.user) && Array.isArray(body.repos);
export const isAnalysisResponse = body =>
  Boolean(body?.analysis) && Array.isArray(body.analysis.dimensions) && Boolean(body.laya);
export const isLearningPathResponse = body =>
  Boolean(body) && Array.isArray(body.steps) && typeof body.roleLabel === 'string';

/**
 * Turns any failure into what the interface needs: `{ kind, message, resetAt }` where kind is
 * `not-found`, `rate-limited`, `invalid`, `network` or `generic`. Messages are safe to show.
 */
export const describeError = (err, { timeZone } = {}) => {
  const code = err instanceof ApiError ? err.code : undefined;
  switch (code) {
    case 'NOT_FOUND':
      return {
        kind: 'not-found',
        message: 'GitHub has no public user or repository with that name.',
      };
    case 'INVALID_INPUT':
      return { kind: 'invalid', message: 'That request was not valid.' };
    case 'RATE_LIMITED': {
      const time = err.resetAt ? formatTime(err.resetAt, { timeZone }) : null;
      return {
        kind: 'rate-limited',
        resetAt: err.resetAt ?? null,
        message: time
          ? `The request limit has been reached. It resets at ${time}.`
          : 'Too many requests. Wait a moment and try again.',
      };
    }
    case 'NETWORK':
      return { kind: 'network', message: 'The LayaProfile server could not be reached.' };
    default:
      return { kind: 'generic', message: 'Something went wrong while loading this data.' };
  }
};
