import { describe, expect, it } from 'vitest';
import { analyzeTree } from './structureChecks';

// A trailing slash marks a directory.
const tree = (...paths) =>
  paths.map(path =>
    path.endsWith('/') ? { path: path.slice(0, -1), type: 'tree' } : { path, type: 'blob' },
  );

describe('analyzeTree', () => {
  it('returns empty flags for a missing or empty tree', () => {
    [null, undefined, []].forEach(value => {
      const flags = analyzeTree(value);
      expect(flags.entryCount).toBe(0);
      Object.entries(flags)
        .filter(([key]) => key !== 'entryCount')
        .forEach(([, list]) => expect(list).toEqual([]));
    });
  });

  it.each([
    ['sourceDir', ['src/'], ['src']],
    [
      'sourceDir',
      ['lib/', 'cmd/', 'internal/', 'pkg/', 'app/'],
      ['lib', 'cmd', 'internal', 'pkg', 'app'],
    ],
    ['sourceFiles', ['main.go', 'tool.py', 'index.js'], ['main.go', 'tool.py', 'index.js']],
    ['tests', ['tests/', '__tests__/', 'test/', 'spec/'], ['tests', '__tests__', 'test', 'spec']],
    [
      'tests',
      ['parser_test.go', 'pytest.ini', 'jest.config.js', 'vitest.config.mjs'],
      ['parser_test.go', 'pytest.ini', 'jest.config.js', 'vitest.config.mjs'],
    ],
    [
      'ci',
      ['.gitlab-ci.yml', '.circleci/', '.travis.yml', 'Jenkinsfile', 'azure-pipelines.yml'],
      ['.gitlab-ci.yml', '.circleci', '.travis.yml', 'Jenkinsfile', 'azure-pipelines.yml'],
    ],
    ['possibleCi', ['.github/'], ['.github']],
    [
      'manifests',
      ['package.json', 'pyproject.toml', 'requirements.txt', 'setup.py', 'Cargo.toml', 'go.mod'],
      ['package.json', 'pyproject.toml', 'requirements.txt', 'setup.py', 'Cargo.toml', 'go.mod'],
    ],
    [
      'manifests',
      ['pom.xml', 'build.gradle.kts', 'Gemfile', 'composer.json', 'App.csproj', 'CMakeLists.txt'],
      ['pom.xml', 'build.gradle.kts', 'Gemfile', 'composer.json', 'App.csproj', 'CMakeLists.txt'],
    ],
    [
      'manifests',
      ['Makefile', 'mix.exs', 'pubspec.yaml', 'Package.swift'],
      ['Makefile', 'mix.exs', 'pubspec.yaml', 'Package.swift'],
    ],
    [
      'docker',
      ['Dockerfile', 'docker-compose.yml', 'compose.yaml', '.dockerignore'],
      ['Dockerfile', 'docker-compose.yml', 'compose.yaml', '.dockerignore'],
    ],
    [
      'docsDir',
      ['docs/', 'mkdocs.yml', 'docusaurus.config.js'],
      ['docs', 'mkdocs.yml', 'docusaurus.config.js'],
    ],
    ['license', ['LICENSE', 'LICENSE.md', 'COPYING'], ['LICENSE', 'LICENSE.md', 'COPYING']],
    ['contributing', ['CONTRIBUTING.md'], ['CONTRIBUTING.md']],
    ['changelog', ['CHANGELOG.md', 'HISTORY.rst'], ['CHANGELOG.md', 'HISTORY.rst']],
    [
      'lint',
      [
        '.editorconfig',
        '.eslintrc.json',
        'eslint.config.mjs',
        '.prettierrc',
        'ruff.toml',
        '.golangci.yml',
        'rustfmt.toml',
      ],
      [
        '.editorconfig',
        '.eslintrc.json',
        'eslint.config.mjs',
        '.prettierrc',
        'ruff.toml',
        '.golangci.yml',
        'rustfmt.toml',
      ],
    ],
  ])('detects %s', (flag, paths, expected) => {
    expect(analyzeTree(tree(...paths))[flag]).toEqual(expected);
  });

  it('matches names case-insensitively and reports the original spelling', () => {
    const flags = analyzeTree(tree('DOCKERFILE', 'makefile', 'SRC/', 'Tests/', 'license', 'Docs/'));
    expect(flags.docker).toEqual(['DOCKERFILE']);
    expect(flags.manifests).toEqual(['makefile']);
    expect(flags.sourceDir).toEqual(['SRC']);
    expect(flags.tests).toEqual(['Tests']);
    expect(flags.license).toEqual(['license']);
    expect(flags.docsDir).toEqual(['Docs']);
  });

  it('treats a .github directory alone as possible CI, never as confirmed CI', () => {
    const flags = analyzeTree(tree('.github/', 'README.md'));
    expect(flags.ci).toEqual([]);
    expect(flags.possibleCi).toEqual(['.github']);
  });

  it('requires directories to be directories and files to be files', () => {
    const flags = analyzeTree(tree('src', 'docs', 'tests'));
    expect(flags.sourceDir).toEqual([]);
    expect(flags.docsDir).toEqual([]);
    expect(flags.tests).toEqual([]);
  });

  it('does not report tests, config scripts or dotfiles as source files', () => {
    const flags = analyzeTree(
      tree(
        'main.py',
        'test_main.py',
        'conftest.py',
        'app.test.js',
        'vite.config.js',
        '.eslintrc.js',
        'setup.py',
      ),
    );
    expect(flags.sourceFiles).toEqual(['main.py']);
  });

  it('ignores nested paths, submodules and malformed entries', () => {
    const flags = analyzeTree([
      { path: 'src/index.js', type: 'blob' },
      { path: 'vendor', type: 'commit' },
      { path: 42, type: 'blob' },
      null,
      { path: 'lib', type: 'tree' },
    ]);
    expect(flags.entryCount).toBe(1);
    expect(flags.sourceDir).toEqual(['lib']);
  });

  it('caps each flag at eight entries', () => {
    const many = Array.from({ length: 20 }, (_, i) => `file${i}.py`);
    expect(analyzeTree(tree(...many)).sourceFiles).toHaveLength(8);
  });

  it('reports hints used by archetype detection', () => {
    const flags = analyzeTree(
      tree('bin/', 'next.config.js', 'public/', 'main.tf', 'helm/', '.zshrc', 'openapi.yaml'),
    );
    expect(flags.binDir).toEqual(['bin']);
    expect(flags.webApp).toEqual(['next.config.js', 'public']);
    expect(flags.infra).toEqual(['main.tf', 'helm']);
    expect(flags.dotfiles).toEqual(['.zshrc']);
    expect(flags.apiSpec).toEqual(['openapi.yaml']);
  });
});
