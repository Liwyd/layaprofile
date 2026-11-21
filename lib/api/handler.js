import { isGitHubError, statusFor, toErrorBody } from '../github/errors';
import { clientKey, createRateLimiter } from '../github/rateLimiter';

const DEFAULT_LIMITER = Symbol.for('layaprofile.apiRateLimiter');

// One limiter per server process, shared by every route.
export const getDefaultLimiter = () => {
  globalThis[DEFAULT_LIMITER] ??= createRateLimiter();
  return globalThis[DEFAULT_LIMITER];
};

const sendError = (res, status, body) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
};

/**
 * Wraps a route function `handle(req) => JSON-serializable` with the shared API plumbing:
 * GET-only, per-client rate limiting, JSON error mapping and logging of unexpected failures.
 */
export const apiHandler = handle => async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendError(res, 405, {
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET requests are supported.' },
    });
    return;
  }

  const { allowed, retryAfterSeconds } = getDefaultLimiter().take(clientKey(req));
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    sendError(res, 429, {
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
    });
    return;
  }

  try {
    const body = await handle(req);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.status(200).json(body);
  } catch (err) {
    if (isGitHubError(err)) {
      if (err.status >= 500) console.warn(`GitHub request failed: ${err.code}: ${err.message}`);
    } else {
      console.error('Unexpected API error:', err);
    }
    sendError(res, statusFor(err), toErrorBody(err));
  }
};
