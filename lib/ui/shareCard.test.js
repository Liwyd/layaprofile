import { describe, expect, it } from 'vitest';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  avatarSource,
  buildCardModel,
  cardFilename,
  describeCard,
  fitFontSize,
  initialsOf,
  isAvatarUrl,
  layoutCard,
  selectTopLanguages,
  selectTopSkills,
  truncateToWidth,
  wrapText,
} from './shareCard';

// Every character is 10 px wide, whatever the font: fitting is then easy to predict.
const measure = text => String(text).length * 10;
// The layout tests use a narrower 5 px so that ordinary text fits its column.
const measureWithFont = text => String(text).length * 5;

describe('truncateToWidth', () => {
  it('leaves text that fits unchanged', () => {
    expect(truncateToWidth('hello', 50, measure)).toBe('hello');
    expect(truncateToWidth('', 50, measure)).toBe('');
  });

  it('shortens with an ellipsis so the result fits', () => {
    const result = truncateToWidth('a very long repository name', 100, measure);
    expect(result.endsWith('…')).toBe(true);
    expect(measure(result)).toBeLessThanOrEqual(100);
    expect(result).toBe('a very lo…');
  });

  it('does not leave a space before the ellipsis', () => {
    expect(truncateToWidth('abcd efgh', 60, measure)).toBe('abcd…');
  });

  it('cuts whole code points, never half an emoji', () => {
    const result = truncateToWidth('😀😀😀😀', 30, string => Array.from(string).length * 10);
    expect(result).toBe('😀😀…');
  });

  it('returns an empty string when not even an ellipsis fits', () => {
    expect(truncateToWidth('abc', 5, measure)).toBe('');
  });

  it('tolerates a missing value', () => {
    expect(truncateToWidth(undefined, 10, measure)).toBe('');
  });
});

describe('wrapText', () => {
  it('wraps greedily at word boundaries', () => {
    expect(wrapText('aa bb cc dd', 50, measure, 5)).toEqual(['aa bb', 'cc dd']);
  });

  it('ends the last allowed line with an ellipsis when the text is longer', () => {
    const lines = wrapText('one two three four five six seven', 80, measure, 2);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('one two');
    expect(lines[1].endsWith('…')).toBe(true);
    lines.forEach(line => expect(measure(line)).toBeLessThanOrEqual(80));
  });

  it('truncates a single word that is wider than a line', () => {
    const lines = wrapText('supercalifragilistic ok', 60, measure, 3);
    expect(lines[0]).toBe('super…');
    expect(lines[1]).toBe('ok');
  });

  it('returns no lines for empty text', () => {
    expect(wrapText('   ', 100, measure, 3)).toEqual([]);
    expect(wrapText(undefined, 100, measure, 3)).toEqual([]);
  });
});

describe('fitFontSize', () => {
  it('takes the largest size that fits', () => {
    const measureAt = size => size * 10;
    expect(fitFontSize([36, 32, 28], 400, measureAt)).toBe(36);
    expect(fitFontSize([36, 32, 28], 330, measureAt)).toBe(32);
    expect(fitFontSize([36, 32, 28], 285, measureAt)).toBe(28);
  });

  it('falls back to the smallest size when nothing fits', () => {
    expect(fitFontSize([36, 32, 28], 10, size => size * 10)).toBe(28);
  });
});

describe('initialsOf', () => {
  it('takes the first letters of the first two words', () => {
    expect(initialsOf('Linus Torvalds')).toBe('LT');
    expect(initialsOf('dan abramov jr')).toBe('DA');
  });

  it('uses one letter for a single word and handles separators', () => {
    expect(initialsOf('torvalds')).toBe('T');
    expect(initialsOf('some-login_name')).toBe('SL');
  });

  it('falls back to a question mark and keeps non-Latin letters whole', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(undefined)).toBe('?');
    expect(initialsOf('علی کریمی')).toBe('عک');
  });
});

describe('selectTopSkills', () => {
  const category = (id, strength, extra = {}) => ({
    id,
    label: id.toUpperCase(),
    strength,
    source: 'observed',
    repoCount: 1,
    ...extra,
  });

  it('takes the three strongest categories with their strength words', () => {
    const result = selectTopSkills({
      categories: [
        category('a', 'weak'),
        category('b', 'repeated'),
        category('c', 'observed'),
        category('d', 'observed', { repoCount: 5 }),
        category('e', 'repeated', { repoCount: 9 }),
      ],
    });
    expect(result.map(skill => skill.label)).toEqual(['E', 'B', 'D']);
    expect(result.map(skill => skill.strengthText)).toEqual(['repeated', 'repeated', 'observed']);
  });

  it('keeps the original order for equal strength and count', () => {
    const result = selectTopSkills({
      categories: [category('x', 'observed'), category('y', 'observed'), category('z', 'observed')],
    });
    expect(result.map(skill => skill.label)).toEqual(['X', 'Y', 'Z']);
  });

  it('never lists a category without evidence or one that only a model predicted', () => {
    const result = selectTopSkills({
      categories: [
        category('none', 'unknown', { source: 'none' }),
        category('model', 'weak', { source: 'model-inferred' }),
        category('real', 'weak'),
      ],
    });
    expect(result.map(skill => skill.label)).toEqual(['REAL']);
  });

  it('honours a smaller limit and tolerates missing data', () => {
    const categories = [category('a', 'repeated'), category('b', 'observed')];
    expect(selectTopSkills({ categories }, 1)).toHaveLength(1);
    expect(selectTopSkills(undefined)).toEqual([]);
    expect(selectTopSkills({ categories: [null] })).toEqual([]);
  });

  it('exposes no percentage anywhere', () => {
    const [skill] = selectTopSkills({ categories: [category('a', 'repeated')] });
    expect(JSON.stringify(skill)).not.toMatch(/%|percent/i);
  });
});

describe('selectTopLanguages', () => {
  const repo = (language, extra = {}) => ({ language, fork: false, ...extra });

  it('counts own repositories by primary language, most used first', () => {
    const repos = [
      repo('Go'),
      repo('Go'),
      repo('Rust'),
      repo('Go'),
      repo('C'),
      repo('C'),
      repo('Zig', { fork: true }),
      repo(null),
    ];
    expect(selectTopLanguages(repos)).toEqual([
      { name: 'Go', count: 3 },
      { name: 'C', count: 2 },
      { name: 'Rust', count: 1 },
    ]);
  });

  it('keeps at most the limit and adds no "Others" bucket', () => {
    const repos = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(name => repo(name));
    const result = selectTopLanguages(repos, 5);
    expect(result).toHaveLength(5);
    expect(result.some(language => language.name === 'Others')).toBe(false);
  });

  it('returns nothing when no language is known', () => {
    expect(selectTopLanguages([repo(null)])).toEqual([]);
    expect(selectTopLanguages(undefined)).toEqual([]);
  });
});

describe('avatar helpers', () => {
  it('accepts only https addresses on GitHub avatar CDN', () => {
    expect(isAvatarUrl('https://avatars.githubusercontent.com/u/1?v=4')).toBe(true);
    expect(isAvatarUrl('http://avatars.githubusercontent.com/u/1')).toBe(false);
    expect(isAvatarUrl('https://example.com/u/1')).toBe(false);
    expect(isAvatarUrl('https://avatars.githubusercontent.com.evil.test/u/1')).toBe(false);
    expect(isAvatarUrl('data:image/png;base64,AAAA')).toBe(false);
    expect(isAvatarUrl('not a url')).toBe(false);
    expect(isAvatarUrl(undefined)).toBe(false);
  });

  it('asks the CDN for a size and keeps the other parameters', () => {
    expect(avatarSource('https://avatars.githubusercontent.com/u/1?v=4', 240)).toBe(
      'https://avatars.githubusercontent.com/u/1?v=4&s=240',
    );
    expect(avatarSource('https://avatars.githubusercontent.com/u/1?s=460', 240)).toBe(
      'https://avatars.githubusercontent.com/u/1?s=240',
    );
  });
});

describe('cardFilename', () => {
  it('uses the lowercased login and falls back for an invalid one', () => {
    expect(cardFilename('Torvalds')).toBe('layaprofile-torvalds.png');
    expect(cardFilename('../evil')).toBe('layaprofile-profile.png');
    expect(cardFilename(undefined)).toBe('layaprofile-profile.png');
  });
});

const NOW = Date.parse('2026-11-21T10:00:00Z');

const profile = (overrides = {}) => ({
  user: {
    login: 'torvalds',
    name: 'Linus Torvalds',
    avatar_url: 'https://avatars.githubusercontent.com/u/1024025?v=4',
  },
  repos: [
    { language: 'C', fork: false },
    { language: 'C', fork: false },
  ],
  profileScore: { score: 72, label: 'Good', coverage: 0.83 },
  skills: {
    categories: [
      { id: 'systems', label: 'Systems programming', strength: 'repeated', repoCount: 3 },
      { id: 'backend', label: 'Backend development', strength: 'weak', repoCount: 1 },
    ],
  },
  ...overrides,
});

describe('buildCardModel', () => {
  it('collects what the card shows', () => {
    const model = buildCardModel(profile(), NOW);
    expect(model).toMatchObject({
      name: 'Linus Torvalds',
      login: 'torvalds',
      initials: 'LT',
      score: 72,
      label: 'Good',
      coverage: 0.83,
      footer: 'LayaProfile · Nov 21, 2026 · public GitHub data',
    });
    expect(model.avatarUrl).toMatch(/^https:\/\/avatars\.githubusercontent\.com\//);
    expect(model.skills.map(skill => skill.label)).toEqual([
      'Systems programming',
      'Backend development',
    ]);
    expect(model.languages).toEqual([{ name: 'C', count: 2 }]);
  });

  it('falls back to the login when there is no name', () => {
    const model = buildCardModel(
      profile({ user: { login: 'octocat', name: '  ', avatar_url: null } }),
      NOW,
    );
    expect(model.name).toBe('octocat');
    expect(model.avatarUrl).toBeNull();
  });

  it('keeps a missing score as null, never zero', () => {
    const missing = buildCardModel(profile({ profileScore: undefined }), NOW);
    expect(missing.score).toBeNull();
    expect(missing.coverage).toBeNull();
    expect(missing.label).toBe('Not assessed');
    const insufficient = buildCardModel(
      profile({ profileScore: { score: null, label: 'Insufficient evidence', coverage: 0.2 } }),
      NOW,
    );
    expect(insufficient.score).toBeNull();
    expect(insufficient.label).toBe('Insufficient evidence');
  });

  it('omits an unusable date from the footer', () => {
    expect(buildCardModel(profile(), 'never').footer).toBe('LayaProfile · public GitHub data');
  });
});

describe('describeCard', () => {
  it('describes the score, skills and languages in words', () => {
    const text = describeCard(buildCardModel(profile(), NOW));
    expect(text).toContain('Linus Torvalds, @torvalds');
    expect(text).toContain('score 72 of 100, Good, evidence coverage 83%');
    expect(text).toContain('Systems programming (repeated)');
    expect(text).toContain('C (2)');
  });

  it('says so when there is nothing to show', () => {
    const text = describeCard(
      buildCardModel(profile({ profileScore: undefined, skills: undefined, repos: [] }), NOW),
    );
    expect(text).toContain('score not available');
    expect(text).toContain('No skill evidence found');
    expect(text).toContain('No primary language reported');
  });
});

describe('layoutCard', () => {
  const textOps = layout => layout.ops.filter(op => op.type === 'text');

  it('lays out a card of the fixed size', () => {
    const layout = layoutCard(buildCardModel(profile(), NOW), measureWithFont);
    expect(layout.width).toBe(CARD_WIDTH);
    expect(layout.height).toBe(CARD_HEIGHT);
    expect(layout.ops.filter(op => op.type === 'avatar')).toHaveLength(1);
  });

  it('puts the name, login, score, label, skills, languages and footer on the card', () => {
    const texts = textOps(layoutCard(buildCardModel(profile(), NOW), measureWithFont)).map(
      op => op.text,
    );
    expect(texts).toEqual(
      expect.arrayContaining([
        'Linus Torvalds',
        '@torvalds',
        '72',
        'Good',
        'Systems programming',
        'REPEATED',
        'C',
        '2',
        '83%',
        'LayaProfile · Nov 21, 2026 · public GitHub data',
      ]),
    );
  });

  it('keeps every operation inside the card', () => {
    const layout = layoutCard(buildCardModel(profile(), NOW), measureWithFont);
    layout.ops.forEach(op => {
      if (op.type === 'rect') {
        expect(op.x).toBeGreaterThanOrEqual(0);
        expect(op.y).toBeGreaterThanOrEqual(0);
        expect(op.x + op.w).toBeLessThanOrEqual(CARD_WIDTH);
        expect(op.y + op.h).toBeLessThanOrEqual(CARD_HEIGHT);
      } else if (op.type === 'text') {
        expect(op.y).toBeLessThanOrEqual(CARD_HEIGHT);
      }
    });
  });

  it('truncates long text so that it fits its column', () => {
    const long = 'x'.repeat(200);
    const model = buildCardModel(
      profile({
        user: { login: 'a'.repeat(39), name: long, avatar_url: null },
        skills: {
          categories: [{ id: 'a', label: long, strength: 'repeated', repoCount: 1 }],
        },
        repos: [{ language: long, fork: false }],
        profileScore: { score: 50, label: long, coverage: 1 },
      }),
      NOW,
    );
    const layout = layoutCard(model, measureWithFont);
    const ellipsized = textOps(layout).filter(op => op.text.endsWith('…'));
    // The name, the skill, the language and the label were all cut.
    expect(ellipsized.length).toBeGreaterThanOrEqual(4);
    textOps(layout).forEach(op => {
      expect(op.text.length * 5).toBeLessThanOrEqual(CARD_WIDTH - 128);
    });
    const name = textOps(layout).find(op => op.text.startsWith('xxx') && op.font.includes('56px'));
    expect(name.text.length * 5).toBeLessThanOrEqual(744 - 216);
  });

  it('shows a dash, an explanation and no coverage bar when there is no score', () => {
    const model = buildCardModel(profile({ profileScore: undefined }), NOW);
    const layout = layoutCard(model, measureWithFont);
    const texts = textOps(layout).map(op => op.text);
    expect(texts).toContain('—');
    expect(texts).not.toContain('/100');
    expect(texts).toContain('Not enough public data to assign a score.');
    expect(texts).not.toContain('EVIDENCE COVERAGE');
  });

  it('shrinks a long label before it truncates it', () => {
    // Width grows with the font size: half the size in pixels per character.
    const scaled = (value, spec) => value.length * (Number(/(\d+)px/.exec(spec)[1]) / 2);
    const label = 'Insufficient evidence';
    const model = buildCardModel(
      profile({ profileScore: { score: null, label, coverage: 0.3 } }),
      NOW,
    );
    const op = layoutCard(model, scaled).ops.find(
      item => item.type === 'text' && item.text === label,
    );
    expect(op).toBeDefined();
    // 21 characters: 36 px needs 378 px, 32 px needs 336 px, 28 px needs 294 px (column: 312).
    expect(op.font).toContain('28px');
  });

  it('says so when no skill or language is known', () => {
    const model = buildCardModel(profile({ skills: undefined, repos: [] }), NOW);
    const texts = textOps(layoutCard(model, measureWithFont)).map(op => op.text);
    expect(texts).toContain('No skill evidence found in public repositories.');
    expect(texts).toContain('No primary language reported.');
  });

  it('draws no more than three skills and five languages', () => {
    const categories = ['a', 'b', 'c', 'd', 'e'].map(id => ({
      id,
      label: `Skill ${id}`,
      strength: 'observed',
      repoCount: 1,
    }));
    const repos = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(language => ({ language, fork: false }));
    const model = buildCardModel(profile({ skills: { categories }, repos }), NOW);
    const texts = textOps(layoutCard(model, measureWithFont)).map(op => op.text);
    expect(texts.filter(text => text.startsWith('Skill '))).toHaveLength(3);
    expect(texts.filter(text => /^[A-G]$/.test(text))).toHaveLength(5);
  });

  it('is deterministic', () => {
    const model = buildCardModel(profile(), NOW);
    expect(layoutCard(model, measureWithFont)).toEqual(layoutCard(model, measureWithFont));
  });
});
