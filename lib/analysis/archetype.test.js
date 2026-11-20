import { describe, expect, it } from 'vitest';
import { detectArchetype } from './archetype';
import { makeEvidence } from './testHelpers';

const files = (...paths) =>
  paths.map(path =>
    path.endsWith('/') ? { path: path.slice(0, -1), type: 'tree' } : { path, type: 'blob' },
  );

const detect = ({ name = 'project', description = null, topics = [], tree = [], readme } = {}) =>
  detectArchetype(
    makeEvidence({
      repo: { name, description, topics },
      tree,
      readme: readme && { text: readme, truncated: false, available: true },
    }),
  );

describe('detectArchetype', () => {
  it.each([
    [
      'cli-tool',
      {
        name: 'fastgrep',
        topics: ['cli', 'golang'],
        description: 'Fast search',
        tree: files('cmd/', 'go.mod'),
      },
    ],
    [
      'api-service',
      {
        name: 'todo-backend',
        topics: ['rest-api'],
        description: 'A REST server for todos',
        tree: files('Dockerfile', 'src/'),
      },
    ],
    [
      'infrastructure',
      { name: 'cloud', description: 'Terraform modules for our cloud', tree: files('main.tf') },
    ],
    [
      'learning-project',
      { name: 'learn-rust', topics: ['tutorial', 'rust'], tree: files('main.rs') },
    ],
    [
      'documentation',
      {
        name: 'awesome-go-tools',
        topics: ['awesome', 'list'],
        tree: files('README.md', 'LICENSE'),
      },
    ],
    ['config-dotfiles', { name: 'dotfiles', tree: files('.zshrc', '.vimrc') }],
    ['framework', { name: 'webkit', topics: ['framework'], description: 'A web framework for Go' }],
    [
      'library',
      {
        name: 'datekit',
        topics: ['library'],
        description: 'A date library',
        tree: files('src/', 'package.json'),
      },
    ],
    [
      'application',
      { name: 'shop', topics: ['webapp'], tree: files('index.html', 'vite.config.js', 'public/') },
    ],
  ])('detects %s with strong confidence', (expected, input) => {
    const result = detect(input);
    expect(result.archetype).toBe(expected);
    expect(result.confidence).toBe('strong');
    expect(result.signals.length).toBeGreaterThanOrEqual(2);
    result.signals.forEach(signal => {
      expect(signal.detail.length).toBeGreaterThan(0);
      expect(signal.archetype).toBeTruthy();
    });
  });

  it('returns unknown with no signals when nothing matches', () => {
    const result = detect({ name: 'hello', tree: files('notes.txt') });
    expect(result).toMatchObject({ archetype: 'unknown', confidence: 'none', signals: [] });
  });

  it('reports a single signal as weak', () => {
    const result = detect({ topics: ['cli'] });
    expect(result).toMatchObject({ archetype: 'cli-tool', confidence: 'weak' });
    expect(result.signals).toHaveLength(1);
  });

  it('reports an exact tie as weak and lists every matched signal', () => {
    const result = detect({ topics: ['cli', 'api'] });
    expect(result.confidence).toBe('weak');
    expect(result.archetype).toBe('cli-tool'); // fixed priority order breaks the tie
    expect(result.scores).toMatchObject({ 'cli-tool': 1, 'api-service': 1 });
  });

  it('reports a narrow lead for two competing archetypes as strong only when it leads', () => {
    const result = detect({
      topics: ['cli', 'terminal'],
      description: 'A command-line API client',
      tree: files('bin/'),
    });
    expect(result.archetype).toBe('cli-tool');
    expect(result.confidence).toBe('strong');
  });

  it('does not count file evidence without matching metadata', () => {
    expect(detect({ tree: files('bin/') }).archetype).toBe('unknown');
    expect(detect({ tree: files('Dockerfile') }).archetype).toBe('unknown');
    expect(detect({ tree: files('package.json') }).archetype).toBe('unknown');
  });

  it('does not call a library a library when application files are present', () => {
    const result = detect({
      topics: ['library'],
      tree: files('package.json', 'next.config.js', 'public/'),
    });
    expect(result.scores.library).toBe(1);
    expect(result.scores.application).toBe(1);
    expect(result.confidence).toBe('weak');
  });

  it('does not mistake machine learning for a learning project', () => {
    const result = detect({ topics: ['machine-learning', 'deep-learning'] });
    expect(result.scores['learning-project']).toBe(0);
  });

  it('uses README headings as a weak signal', () => {
    const result = detect({ readme: '# T\n\n## Endpoints\n\nGET /users\n' });
    expect(result).toMatchObject({ archetype: 'api-service', confidence: 'weak' });
    expect(result.signals[0].id).toBe('readme-headings');
  });

  it('works without a README or a file listing', () => {
    const evidence = makeEvidence({
      repo: { topics: ['framework'], description: 'A framework' },
      tree: null,
      readme: { text: null, truncated: false, available: false },
    });
    expect(detectArchetype(evidence).archetype).toBe('framework');
  });

  it('is deterministic', () => {
    const input = { topics: ['cli', 'api'], tree: files('bin/', 'Dockerfile') };
    expect(detect(input)).toEqual(detect(input));
  });
});
