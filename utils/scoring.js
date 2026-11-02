/**
 * Profile quality scoring engine.
 * Evaluates profile completeness, documentation, bio, website, etc.
 */
export function calculateProfileScore(user) {
  if (!user) return { score: 0, breakdown: {}, classification: 'Insufficient evidence' };

  let score = 0;
  const breakdown = {
    bio: user.bio ? 20 : 0,
    blog: user.blog ? 15 : 0,
    company: user.company ? 10 : 0,
    location: user.location ? 10 : 0,
    publicRepos: user.public_repos > 5 ? 25 : user.public_repos > 0 ? 15 : 0,
    followers: user.followers > 10 ? 20 : user.followers > 0 ? 10 : 0,
  };

  score = Object.values(breakdown).reduce((a, b) => a + b, 0);

  let classification = 'Needs improvement';
  if (score >= 80) classification = 'Excellent';
  else if (score >= 60) classification = 'Good';

  return {
    score,
    breakdown,
    classification,
  };
}

/**
 * Repository quality scoring engine.
 * Evaluates documentation (README presence), metadata (description, license, topics), and maintenance.
 */
export function calculateRepositoryScore(repo) {
  if (!repo) return { score: 0, breakdown: {}, classification: 'Insufficient evidence' };

  const documentation = repo.has_readme !== false ? 30 : 0; // fallback if computed
  const metadata = (repo.description ? 15 : 0) + (repo.license ? 10 : 0) + (repo.topics && repo.topics.length > 0 ? 15 : 0);
  const maintenance = repo.archived ? 0 : 25;
  const structure = 15; // default structural estimate

  const score = documentation + metadata + maintenance + structure;

  let classification = 'Needs improvement';
  if (score >= 80) classification = 'Excellent';
  else if (score >= 60) classification = 'Good';

  return {
    score,
    breakdown: {
      documentation,
      metadata,
      maintenance,
      structure,
    },
    classification,
  };
}
