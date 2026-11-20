import { describe, expect, it } from 'vitest';
import { isValidBranchName, isValidRepoName, isValidUsername } from './validation';

describe('isValidUsername', () => {
  it.each(['a', 'torvalds', 'bchiang7', 'a-b', 'a-b-c', 'User123', '0', 'a'.repeat(39)])(
    'accepts %s',
    name => {
      expect(isValidUsername(name)).toBe(true);
    },
  );

  it.each([
    ['empty string', ''],
    ['40 characters', 'a'.repeat(40)],
    ['leading hyphen', '-abc'],
    ['trailing hyphen', 'abc-'],
    ['double hyphen', 'a--b'],
    ['only a hyphen', '-'],
    ['underscore', 'a_b'],
    ['dot', 'a.b'],
    ['space', 'a b'],
    ['leading space', ' abc'],
    ['trailing newline', 'abc\n'],
    ['unicode letters', 'ünïcode'],
    ['emoji', 'dev\u{1F600}'],
    ['path traversal', '../x'],
    ['slash', 'a/b'],
    ['query injection', 'a?b=c'],
    ['at sign', '@octocat'],
  ])('rejects %s', (_label, name) => {
    expect(isValidUsername(name)).toBe(false);
  });

  it.each([undefined, null, 42, {}, ['abc']])('rejects non-string input %s', value => {
    expect(isValidUsername(value)).toBe(false);
  });
});

describe('isValidRepoName', () => {
  it.each(['a', 'octoprofile', 'my.repo', 'my_repo', 'my-repo', '.github', '...', 'a'.repeat(100)])(
    'accepts %s',
    name => {
      expect(isValidRepoName(name)).toBe(true);
    },
  );

  it.each([
    ['empty string', ''],
    ['101 characters', 'a'.repeat(101)],
    ['single dot', '.'],
    ['double dot', '..'],
    ['slash', 'a/b'],
    ['path traversal', '../x'],
    ['space', 'a b'],
    ['unicode letters', 'répo'],
    ['trailing newline', 'repo\n'],
    ['query injection', 'a?b'],
  ])('rejects %s', (_label, name) => {
    expect(isValidRepoName(name)).toBe(false);
  });

  it.each([undefined, null, 42, {}])('rejects non-string input %s', value => {
    expect(isValidRepoName(value)).toBe(false);
  });
});

describe('isValidBranchName', () => {
  it.each(['main', 'master', 'develop', 'feature/login', 'release-1.2.3', 'v1', 'a'.repeat(255)])(
    'accepts %s',
    name => {
      expect(isValidBranchName(name)).toBe(true);
    },
  );

  it.each([
    ['empty string', ''],
    ['256 characters', 'a'.repeat(256)],
    ['leading slash', '/main'],
    ['parent segment', 'a/../b'],
    ['double dot', 'a..b'],
    ['space', 'my branch'],
    ['tab', 'a\tb'],
    ['newline', 'main\n'],
    ['control character', 'a\u0000b'],
    ['number', 42],
    ['undefined', undefined],
    ['null', null],
  ])('rejects %s', (label, value) => {
    expect(isValidBranchName(value)).toBe(false);
  });
});
