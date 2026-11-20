// Shared fixtures for the analysis tests. Never imported by application code.
import { fullRepo } from '../github/testHelpers';

export const NOW = Date.parse('2024-06-01T00:00:00Z');
export const MS_PER_DAY = 86_400_000;

export const daysAgo = days => new Date(NOW - days * MS_PER_DAY).toISOString();

const filler = count => Array.from({ length: count }, (_, i) => `word${i}`).join(' ');

// A README that satisfies every documentation check.
export const FULL_README = `# Hello

![badge](https://img.shields.io/badge/x-y-green.svg)

${filler(160)}

## Installation

\`\`\`sh
npm install hello
\`\`\`

## Usage

\`\`\`js
import hello from 'hello';
hello();
\`\`\`

## Configuration

Set options in \`hello.config.js\`.

## Documentation

See the [docs](https://example.com/docs).

## Contributing

Pull requests are welcome.

## License

MIT
`;

// A top-level listing that satisfies every structure check.
export const FULL_TREE = [
  { path: 'src', type: 'tree' },
  { path: 'tests', type: 'tree' },
  { path: 'docs', type: 'tree' },
  { path: 'package.json', type: 'blob' },
  { path: '.gitlab-ci.yml', type: 'blob' },
  { path: 'LICENSE', type: 'blob' },
  { path: '.editorconfig', type: 'blob' },
  { path: 'README.md', type: 'blob' },
];

/** Repository evidence in the shape of `loadRepoEvidence`, complete and healthy by default. */
export const makeEvidence = ({ repo = {}, readme, tree, release, unavailable = [] } = {}) => ({
  repo: {
    ...(() => {
      const { owner: _owner, node_id: _nodeId, ...rest } = fullRepo();
      return rest;
    })(),
    description: 'A well documented example repository',
    topics: ['cli', 'tool', 'example'],
    homepage: 'https://hello.example.com',
    license: { spdx_id: 'MIT', name: 'MIT License' },
    pushed_at: daysAgo(10),
    archived: false,
    fork: false,
    has_issues: true,
    ...repo,
  },
  readme: readme === undefined ? { text: FULL_README, truncated: false, available: true } : readme,
  tree: tree === undefined ? FULL_TREE : tree,
  release: release === undefined ? { tag_name: 'v1.0.0', published_at: daysAgo(30) } : release,
  languages: { JavaScript: 100 },
  unavailable,
  fetchedAt: daysAgo(0),
  cached: false,
  stale: false,
});

export const noReadme = { text: null, truncated: false, available: false };
