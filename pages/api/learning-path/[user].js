import { apiHandler } from '../../../lib/api/handler';
import { ROLE_IDS, buildLearningPath, isKnownRole } from '../../../lib/analysis/learningPath';
import { GitHubError } from '../../../lib/github/errors';
import { getDefaultClient } from '../../../lib/github/client';
import { loadProfile } from '../../../lib/github/profile';

// GET /api/learning-path/[user]?role=backend
// Built from the profile only (skills and profile score): repository analyses are not loaded
// here, so file-based foundations and portfolio gaps are reported as not assessed.
export default apiHandler(async req => {
  const { role } = req.query;
  if (!isKnownRole(role)) {
    throw new GitHubError(
      'INVALID_INPUT',
      `Unknown role. Expected one of: ${ROLE_IDS.join(', ')}.`,
    );
  }

  const profile = await loadProfile(getDefaultClient(), req.query.user);
  return {
    ...buildLearningPath({ skills: profile.skills, profileScore: profile.profileScore }, { role }),
    profile: {
      login: profile.user.login,
      fetchedAt: profile.fetchedAt,
      cached: profile.cached,
      stale: profile.stale,
    },
  };
});
