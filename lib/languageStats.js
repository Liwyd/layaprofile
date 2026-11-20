import langColors from '../utils/langColors';

export const FALLBACK_LANGUAGE_COLOR = '#cccccc';

export const getLanguageColor = language =>
  (Object.hasOwn(langColors, language) && langColors[language]) || FALLBACK_LANGUAGE_COLOR;

const OTHERS_LABEL = 'Others';
const DEFAULT_LIMIT = 5;

/**
 * Counts own (non-fork) repositories by their primary language, as reported by the
 * GitHub `language` field. This is a repository count, not a share of code written.
 * Returns the `limit` most used languages plus an aggregated "Others" entry, shaped as
 * [{ label, value, color }] sorted by value (descending), then label.
 */
export const computeLanguageStats = (repos, limit = DEFAULT_LIMIT) => {
  if (!Array.isArray(repos)) return [];

  const counts = new Map();
  repos.forEach(repo => {
    if (!repo || repo.fork || !repo.language) return;
    counts.set(repo.language, (counts.get(repo.language) || 0) + 1);
  });

  const sorted = [...counts.entries()]
    .map(([label, value]) => ({
      label,
      value,
      color: getLanguageColor(label),
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  const top = sorted.slice(0, limit);
  const rest = sorted.slice(limit);
  if (rest.length > 0) {
    top.push({
      label: OTHERS_LABEL,
      value: rest.reduce((sum, lang) => sum + lang.value, 0),
      color: FALLBACK_LANGUAGE_COLOR,
    });
  }
  return top;
};
