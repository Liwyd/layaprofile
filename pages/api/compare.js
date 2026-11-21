import { apiHandler } from '../../lib/api/handler';
import { compareProfiles } from '../../lib/analysis/compare';
import { GitHubError, isGitHubError } from '../../lib/github/errors';
import { getDefaultClient } from '../../lib/github/client';
import { loadProfile } from '../../lib/github/profile';
import { isValidUsername } from '../../lib/validation';

const SIDES = ['a', 'b'];

const single = value => (typeof value === 'string' ? value : undefined);

const summarizeSide = profile => ({
  user: {
    login: profile.user.login,
    name: profile.user.name ?? null,
    avatar_url: profile.user.avatar_url,
    html_url: profile.user.html_url,
    bio: profile.user.bio ?? null,
    followers: profile.user.followers,
    created_at: profile.user.created_at,
  },
  profileScore: {
    score: profile.profileScore.score,
    label: profile.profileScore.label,
    coverage: profile.profileScore.coverage,
  },
  truncated: profile.truncated,
  fetchedAt: profile.fetchedAt,
  cached: profile.cached,
  stale: profile.stale,
});

// When both sides fail, a failure that is not "not found" (a rate limit, GitHub being down)
// is reported first because it is not about either user.
const pickFailure = results => {
  const failures = results.map((result, index) => ({ result, which: SIDES[index] }));
  const rejected = failures.filter(({ result }) => result.status === 'rejected');
  const systemic = rejected.find(
    ({ result }) => !isGitHubError(result.reason) || result.reason.code !== 'NOT_FOUND',
  );
  const { result, which } = systemic ?? rejected[0];
  const err = result.reason;
  if (isGitHubError(err) && err.code === 'NOT_FOUND') {
    return new GitHubError('NOT_FOUND', `GitHub user ${which} was not found.`, { which });
  }
  return err;
};

// GET /api/compare?a=user1&b=user2
export default apiHandler(async req => {
  const names = SIDES.map(side => single(req.query[side]));
  names.forEach((name, index) => {
    if (!isValidUsername(name)) {
      throw new GitHubError('INVALID_INPUT', `Invalid GitHub username for ${SIDES[index]}.`, {
        which: SIDES[index],
      });
    }
  });
  if (names[0].toLowerCase() === names[1].toLowerCase()) {
    throw new GitHubError('INVALID_INPUT', 'Choose two different GitHub usernames to compare.');
  }

  const now = Date.now();
  const client = getDefaultClient();
  const results = await Promise.allSettled(names.map(name => loadProfile(client, name, { now })));
  if (results.some(result => result.status === 'rejected')) throw pickFailure(results);

  const [a, b] = results.map(result => result.value);
  return {
    a: summarizeSide(a),
    b: summarizeSide(b),
    comparison: compareProfiles(a, b, { now }),
  };
});
