import { describe, expect, it } from 'vitest';
import {
  MAX_EXCERPT_CHARS,
  MAX_README_CHARS,
  MAX_TOP_LEVEL_FILES,
  buildReadmeState,
  buildRepoSummary,
  cleanReadme,
  pickModel,
} from './state';

describe('cleanReadme', () => {
  it('removes HTML comments, tags and images but keeps the text', () => {
    const raw = [
      '<!-- hidden note -->',
      '<h1 align="center">Hello</h1>',
      '<img src="logo.png" width="100">',
      '![badge](https://img.shields.io/x.svg)',
      '[![build](https://ci/badge.svg)](https://ci)',
      '',
      'A <b>small</b> tool.  <a href="https://example.com">Docs</a>',
    ].join('\n');
    const { text, truncated } = cleanReadme(raw);
    expect(text).not.toMatch(/<|>|!\[|hidden note|logo\.png|shields/);
    expect(text).toContain('Hello');
    expect(text).toContain('A small tool. Docs');
    expect(truncated).toBe(false);
  });

  it('keeps placeholders such as <repo-url> and <package>', () => {
    const { text } = cleanReadme(
      '```sh\ngit clone <repo-url>\nnpm install <package>\n```\n<p>Hi</p>',
    );
    expect(text).toContain('git clone <repo-url>');
    expect(text).toContain('npm install <package>');
    expect(text).toContain('Hi');
    expect(text).not.toContain('<p>');
  });

  it('collapses whitespace and keeps line structure', () => {
    const { text } = cleanReadme('# Title   \r\n\r\n\r\n\r\n   text\twith   gaps  \n');
    expect(text).toBe('# Title\n\ntext with gaps');
  });

  it('drops the rest of the document after an unclosed comment', () => {
    expect(cleanReadme('keep <!-- never closed\nlost').text).toBe('keep');
  });

  it('replaces control characters and lone surrogates', () => {
    const { text } = cleanReadme('a\u0000b\u0007c \uD83D end');
    expect(text).not.toMatch(/\u0000|\u0007/);
    expect(text.isWellFormed()).toBe(true);
  });

  it('truncates to the limit and reports it', () => {
    const { text, truncated } = cleanReadme('word '.repeat(5000));
    expect(text.length).toBeLessThanOrEqual(MAX_README_CHARS);
    expect(truncated).toBe(true);
  });

  it('does not report truncation for text exactly at the limit', () => {
    const { text, truncated } = cleanReadme('a'.repeat(MAX_README_CHARS));
    expect(text).toHaveLength(MAX_README_CHARS);
    expect(truncated).toBe(false);
  });

  it('never cuts a surrogate pair in half', () => {
    const { text } = cleanReadme(`${'a'.repeat(MAX_README_CHARS - 1)}😀 tail`);
    expect(text.isWellFormed()).toBe(true);
    expect(text).toHaveLength(MAX_README_CHARS - 1);
  });

  it('handles non-string input', () => {
    expect(cleanReadme(null)).toEqual({ text: '', truncated: false });
    expect(cleanReadme(undefined).text).toBe('');
  });

  it('stays fast on hostile input', () => {
    const started = Date.now();
    cleanReadme('<!--'.repeat(50_000));
    cleanReadme('<a'.repeat(50_000));
    cleanReadme('![x'.repeat(50_000));
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('buildReadmeState', () => {
  it('returns the README as data under one key', () => {
    expect(buildReadmeState('# Hi\n\nSome text')).toEqual({
      state: { readme: '# Hi\n\nSome text' },
      truncated: false,
    });
  });
});

describe('buildRepoSummary', () => {
  const repo = {
    name: 'hello',
    description: 'A tool',
    topics: ['cli', 'tool'],
    language: 'Go',
    stargazers_count: 99999,
  };

  it('keeps only the summary fields, never popularity', () => {
    const summary = buildRepoSummary({
      repo,
      tree: [
        { path: 'src', type: 'tree' },
        { path: 'README.md', type: 'blob' },
      ],
      readmeText: '# Hello\n\nUse it.',
    });
    expect(summary).toEqual({
      name: 'hello',
      description: 'A tool',
      topics: ['cli', 'tool'],
      primaryLanguage: 'Go',
      topLevelFiles: ['src/', 'README.md'],
      readmeExcerpt: '# Hello\n\nUse it.',
    });
  });

  it('limits the file list and the README excerpt', () => {
    const tree = Array.from({ length: 80 }, (_, i) => ({ path: `file${i}`, type: 'blob' }));
    const summary = buildRepoSummary({ repo, tree, readmeText: 'word '.repeat(1000) });
    expect(summary.topLevelFiles).toHaveLength(MAX_TOP_LEVEL_FILES);
    expect(summary.readmeExcerpt.length).toBeLessThanOrEqual(MAX_EXCERPT_CHARS);
  });

  it('copes with missing evidence', () => {
    expect(buildRepoSummary()).toEqual({
      name: '',
      description: '',
      topics: [],
      primaryLanguage: null,
      topLevelFiles: [],
      readmeExcerpt: '',
    });
    expect(
      buildRepoSummary({ repo: { name: 'x', description: null, language: null } }),
    ).toMatchObject({
      description: '',
      primaryLanguage: null,
    });
  });
});

describe('pickModel', () => {
  it('uses the English checkpoint for Latin text', () => {
    expect(pickModel('A library that parses dates and times.')).toBe('english');
  });

  it('uses the multilingual checkpoint for Persian text', () => {
    expect(pickModel('این پروژه یک ابزار ساده برای مدیریت وظایف است.')).toBe('multilingual');
  });

  it('judges the prose, not the code blocks, of a Persian README', () => {
    const readme = [
      'این پروژه یک ابزار ساده برای مدیریت وظایف است و با پایتون نوشته شده است.',
      '',
      '```bash',
      'pip install todo-cli && todo-cli add "buy milk" && todo-cli list --all --verbose',
      '```',
    ].join('\n');
    expect(pickModel(readme)).toBe('multilingual');
  });

  it('uses the multilingual checkpoint for other scripts and for text without letters', () => {
    expect(pickModel('Это простая библиотека для работы с датами.')).toBe('multilingual');
    expect(pickModel('12345 !!!')).toBe('multilingual');
    expect(pickModel('')).toBe('multilingual');
    expect(pickModel(undefined)).toBe('multilingual');
  });
});
