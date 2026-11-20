import { describe, expect, it } from 'vitest';
import { computeLanguageStats, FALLBACK_LANGUAGE_COLOR, getLanguageColor } from './languageStats';

const repo = (language, extra = {}) => ({ language, fork: false, ...extra });

describe('computeLanguageStats', () => {
  it('returns an empty list for missing or empty input', () => {
    expect(computeLanguageStats(undefined)).toEqual([]);
    expect(computeLanguageStats(null)).toEqual([]);
    expect(computeLanguageStats([])).toEqual([]);
  });

  it('counts repositories per primary language, most used first', () => {
    const stats = computeLanguageStats([
      repo('JavaScript'),
      repo('Python'),
      repo('JavaScript'),
      repo('JavaScript'),
      repo('Python'),
      repo('Go'),
    ]);
    expect(stats.map(({ label, value }) => [label, value])).toEqual([
      ['JavaScript', 3],
      ['Python', 2],
      ['Go', 1],
    ]);
  });

  it('adds the known language color and a fallback for unknown languages', () => {
    const [js, unknown] = computeLanguageStats([
      repo('JavaScript'),
      repo('JavaScript'),
      repo('NotARealLanguage'),
    ]);
    expect(js.color).toBe('#f1e05a');
    expect(unknown.color).toBe(FALLBACK_LANGUAGE_COLOR);
  });

  it('ignores forks and repositories without a language', () => {
    const stats = computeLanguageStats([
      repo('Rust', { fork: true }),
      repo(null),
      repo(undefined),
      repo('Go'),
    ]);
    expect(stats).toEqual([{ label: 'Go', value: 1, color: expect.any(String) }]);
  });

  it('breaks ties alphabetically so the output is deterministic', () => {
    const stats = computeLanguageStats([repo('Ruby'), repo('C'), repo('Go')]);
    expect(stats.map(s => s.label)).toEqual(['C', 'Go', 'Ruby']);
  });

  it('groups languages beyond the limit into "Others"', () => {
    const repos = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].flatMap((lang, i) =>
      Array.from({ length: 10 - i }, () => repo(lang)),
    );
    const stats = computeLanguageStats(repos);
    expect(stats).toHaveLength(6);
    expect(stats.slice(0, 5).map(s => s.label)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(stats[5]).toEqual({ label: 'Others', value: 5 + 4, color: FALLBACK_LANGUAGE_COLOR });
  });

  it('does not add "Others" when every language fits', () => {
    const stats = computeLanguageStats([repo('A'), repo('B')], 2);
    expect(stats.map(s => s.label)).toEqual(['A', 'B']);
  });
});

describe('getLanguageColor', () => {
  it('returns the GitHub color for a known language', () => {
    expect(getLanguageColor('JavaScript')).toBe('#f1e05a');
  });

  it('falls back for unknown, missing and prototype-named languages', () => {
    expect(getLanguageColor('NotARealLanguage')).toBe(FALLBACK_LANGUAGE_COLOR);
    expect(getLanguageColor(null)).toBe(FALLBACK_LANGUAGE_COLOR);
    expect(getLanguageColor(undefined)).toBe(FALLBACK_LANGUAGE_COLOR);
    expect(getLanguageColor('constructor')).toBe(FALLBACK_LANGUAGE_COLOR);
  });
});
