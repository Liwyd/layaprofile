// Maps the top-level entries of a repository to convention flags. Only names are inspected:
// a flag says "an entry with this conventional name was found at the repository root", never
// that the thing it names is good, complete or in use. Entries deeper than the root are not seen.

const MAX_ENTRIES_PER_FLAG = 8;

const SOURCE_DIRECTORIES = new Set(['src', 'lib', 'app', 'pkg', 'cmd', 'internal']);
const SOURCE_EXTENSIONS = new Set([
  'py', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'go', 'rs', 'c', 'h', 'cc', 'cpp', 'cxx', 'hpp',
  'java', 'kt', 'kts', 'swift', 'rb', 'php', 'cs', 'scala', 'ex', 'exs', 'dart', 'zig', 'lua',
  'pl', 'r', 'hs', 'clj', 'sh', 'vue', 'svelte',
]); // prettier-ignore

const TEST_DIRECTORIES = /^(?:tests?|__tests?__|specs?|e2e)$/;
const TEST_FILES =
  /^(?:pytest\.ini|conftest\.py|\.rspec|phpunit\.xml(?:\.dist)?|(?:jest|vitest|playwright|cypress)\.config\.[a-z]+|karma\.conf\.[a-z]+|test_.+\.py|.+_test\.(?:go|py|rb|c|cc|cpp|rs)|.+\.(?:test|spec)\.[a-z]+)$/;

const CI_FILES =
  /^(?:\.gitlab-ci\.ya?ml|\.travis\.ya?ml|jenkinsfile|azure-pipelines\.ya?ml|appveyor\.ya?ml|\.drone\.ya?ml|bitbucket-pipelines\.ya?ml)$/;
const CI_DIRECTORIES = /^(?:\.circleci|\.buildkite)$/;

const MANIFEST_FILES =
  /^(?:package\.json|pyproject\.toml|requirements\.txt|setup\.py|cargo\.toml|go\.mod|pom\.xml|build\.gradle(?:\.kts)?|gemfile|composer\.json|.+\.csproj|cmakelists\.txt|makefile|mix\.exs|pubspec\.yaml|package\.swift)$/;

const DOCKER_FILES =
  /^(?:dockerfile(?:\..+)?|.+\.dockerfile|docker-compose(?:\..+)?\.ya?ml|compose(?:\..+)?\.ya?ml|\.dockerignore)$/;

const DOCS_DIRECTORIES = /^(?:docs?|documentation)$/;
const DOCS_FILES = /^(?:mkdocs\.ya?ml|docusaurus\.config\..+)$/;

const LICENSE_FILES = /^(?:licen[sc]e|copying|unlicense)(?:[._-].+)?$/;
const CONTRIBUTING_FILES = /^contributing(?:\..+)?$/;
const CHANGELOG_FILES = /^(?:changelog|history|changes)(?:[._-].+)?$/;

const LINT_FILES =
  /^(?:\.editorconfig|\.eslintrc(?:\..+)?|eslint\.config\..+|\.prettierrc(?:\..+)?|prettier\.config\..+|\.?ruff\.toml|\.golangci\.ya?ml|\.?rustfmt\.toml|biome\.jsonc?|\.pre-commit-config\.ya?ml|\.flake8|\.pylintrc|\.rubocop\.yml|\.clang-format|\.stylelintrc(?:\..+)?)$/;

// Extra name-based hints, used only to infer what kind of project this is (see archetype.js).
const BIN_DIRECTORIES = /^(?:bin|cmd)$/;
const WEB_APP_FILES =
  /^(?:index\.html|next\.config\..+|vite\.config\..+|nuxt\.config\..+|svelte\.config\..+|angular\.json|webpack\.config\..+|pubspec\.yaml)$/;
const WEB_APP_DIRECTORIES = /^(?:public|android|ios)$/;
const INFRA_FILES = /^(?:.+\.tf|chart\.ya?ml|playbook\.ya?ml|pulumi\.ya?ml|kustomization\.ya?ml)$/;
const INFRA_DIRECTORIES = /^(?:helm|charts?|k8s|kubernetes|terraform|ansible|playbooks)$/;
const DOTFILE_ENTRIES =
  /^(?:\.zshrc|\.bashrc|\.vimrc|\.tmux\.conf|\.gitconfig|\.xinitrc|\.config|init\.vim|init\.lua)$/;
const API_SPEC_FILES = /^(?:openapi|swagger)\.(?:ya?ml|json)$/;

const CONFIG_SCRIPT = /\.(?:config|conf)\.[a-z]+$/;

const extensionOf = name => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1) : '';
};

/**
 * @param {Array<{path: string, type: string}>|null} tree  top-level entries ('blob' or 'tree')
 * @returns flags, each an array of the matching entry names (original case, at most 8):
 *   sourceDir, sourceFiles, tests, ci, possibleCi (.github only), manifests, docker, docsDir,
 *   license, contributing, changelog, lint; hints binDir, webApp, infra, dotfiles, apiSpec;
 *   plus `entryCount`.
 */
export const analyzeTree = tree => {
  const entries = (Array.isArray(tree) ? tree : [])
    .filter(
      entry =>
        entry &&
        typeof entry.path === 'string' &&
        entry.path.length > 0 &&
        !entry.path.includes('/') &&
        (entry.type === 'blob' || entry.type === 'tree'),
    )
    .map(entry => ({
      name: entry.path,
      lower: entry.path.toLowerCase(),
      isDir: entry.type === 'tree',
    }));

  const find = predicate =>
    entries
      .filter(predicate)
      .slice(0, MAX_ENTRIES_PER_FLAG)
      .map(entry => entry.name);
  const dir = pattern => entry => entry.isDir && pattern.test(entry.lower);
  const file = pattern => entry => !entry.isDir && pattern.test(entry.lower);

  const isTest = entry => dir(TEST_DIRECTORIES)(entry) || file(TEST_FILES)(entry);

  // Files already recognized as tests or tooling are not also reported as source files.
  const claimed = new Set();
  entries.filter(isTest).forEach(entry => claimed.add(entry.name));
  [CI_FILES, MANIFEST_FILES, DOCKER_FILES, LINT_FILES].forEach(pattern =>
    entries.filter(file(pattern)).forEach(entry => claimed.add(entry.name)),
  );

  const isSourceFile = entry =>
    !entry.isDir &&
    !entry.name.startsWith('.') &&
    !claimed.has(entry.name) &&
    !CONFIG_SCRIPT.test(entry.lower) &&
    SOURCE_EXTENSIONS.has(extensionOf(entry.lower));

  return {
    entryCount: entries.length,
    sourceDir: find(entry => entry.isDir && SOURCE_DIRECTORIES.has(entry.lower)),
    sourceFiles: find(isSourceFile),
    tests: find(isTest),
    ci: find(entry => dir(CI_DIRECTORIES)(entry) || file(CI_FILES)(entry)),
    possibleCi: find(entry => entry.isDir && entry.lower === '.github'),
    manifests: find(file(MANIFEST_FILES)),
    docker: find(file(DOCKER_FILES)),
    docsDir: find(entry => dir(DOCS_DIRECTORIES)(entry) || file(DOCS_FILES)(entry)),
    license: find(file(LICENSE_FILES)),
    contributing: find(file(CONTRIBUTING_FILES)),
    changelog: find(file(CHANGELOG_FILES)),
    lint: find(file(LINT_FILES)),
    binDir: find(dir(BIN_DIRECTORIES)),
    webApp: find(entry => file(WEB_APP_FILES)(entry) || dir(WEB_APP_DIRECTORIES)(entry)),
    infra: find(entry => file(INFRA_FILES)(entry) || dir(INFRA_DIRECTORIES)(entry)),
    dotfiles: find(entry => DOTFILE_ENTRIES.test(entry.lower)),
    apiSpec: find(file(API_SPEC_FILES)),
  };
};
