import { oldestOf, pickRepo } from './profile';

const OPTIONAL_PARTS = ['readme', 'tree', 'release', 'languages'];

/**
 * Collects the raw GitHub evidence used to assess one repository (scoring happens elsewhere).
 *
 * The repository itself is required: if it cannot be loaded the error propagates.
 * The remaining parts are optional. A part that fails is listed in `unavailable` and
 * logged, and the others are still returned.
 *
 * Reading the result:
 * - `readme.available` is true only when a README exists and was retrieved. When it is
 *   false and "readme" is not in `unavailable`, GitHub confirmed there is no README.
 * - `tree` and `release` are null when GitHub confirmed there is nothing (empty repository,
 *   no release) or when the part is listed in `unavailable`.
 */
export const loadRepoEvidence = async (client, owner, repoName) => {
  const repoResult = await client.getRepo(owner, repoName);
  const branch = repoResult.data.default_branch;

  const settled = await Promise.allSettled([
    client.getReadme(owner, repoName),
    client.getRootTree(owner, repoName, branch),
    client.getLatestRelease(owner, repoName),
    client.getLanguages(owner, repoName),
  ]);

  const unavailable = [];
  const results = {};
  settled.forEach((outcome, index) => {
    const part = OPTIONAL_PARTS[index];
    if (outcome.status === 'fulfilled') {
      results[part] = outcome.value;
      return;
    }
    unavailable.push(part);
    console.warn(
      `Repository evidence "${part}" unavailable for ${owner}/${repoName}: ${
        outcome.reason?.code ?? 'UNKNOWN'
      } ${outcome.reason?.message ?? outcome.reason}`,
    );
  });

  const fulfilled = [repoResult, ...Object.values(results)];
  const readmeData = results.readme?.data ?? null;
  const release = results.release?.data ?? null;

  return {
    repo: pickRepo(repoResult.data),
    readme: {
      text: readmeData?.text ?? null,
      truncated: readmeData?.truncated ?? false,
      available: readmeData !== null,
    },
    tree: results.tree?.data ?? null,
    release: release ? { tag_name: release.tag_name, published_at: release.published_at } : null,
    languages: results.languages?.data ?? null,
    unavailable,
    fetchedAt: oldestOf(fulfilled.map(result => result.fetchedAt)),
    cached: fulfilled.every(result => result.cached),
    stale: fulfilled.some(result => result.stale),
  };
};
