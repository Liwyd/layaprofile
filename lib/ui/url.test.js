import { describe, expect, it } from 'vitest';
import { repoUrl, safeHttpUrl } from './url';

describe('safeHttpUrl', () => {
  it('keeps http and https addresses', () => {
    expect(safeHttpUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com/');
  });

  it('adds https to a bare host and trims whitespace', () => {
    expect(safeHttpUrl('  example.com/portfolio ')).toBe('https://example.com/portfolio');
  });

  it.each(['javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://example.com', 'mailto:a@b.co'])(
    'refuses %s',
    value => {
      expect(safeHttpUrl(value)).toBeNull();
    },
  );

  it('returns null for empty, missing and unparseable values', () => {
    expect(safeHttpUrl('')).toBeNull();
    expect(safeHttpUrl('   ')).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl('http://')).toBeNull();
  });
});

describe('repoUrl', () => {
  it('builds a GitHub link from a full name', () => {
    expect(repoUrl('octocat/Hello-World')).toBe('https://github.com/octocat/Hello-World');
  });

  it('refuses anything that is not owner/name', () => {
    expect(repoUrl('octocat')).toBeNull();
    expect(repoUrl('a/b/c')).toBeNull();
    expect(repoUrl('../etc')).toBeNull();
    expect(repoUrl(undefined)).toBeNull();
  });
});
