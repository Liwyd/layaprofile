import { analyzeReadme } from './readmeChecks';
import { analyzeTree } from './structureChecks';

/**
 * Derives the README and repository-structure facts from collected evidence.
 * Each part is null when there is nothing to inspect (no README text, no tree).
 */
export const repoFacts = evidence => ({
  readme:
    evidence.readme?.available && typeof evidence.readme.text === 'string'
      ? analyzeReadme(evidence.readme.text)
      : null,
  structure:
    Array.isArray(evidence.tree) && evidence.tree.length > 0 ? analyzeTree(evidence.tree) : null,
});
