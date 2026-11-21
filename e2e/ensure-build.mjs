// Runs before `npm run test:e2e` (npm's "pre" script hook). The end-to-end tests exercise the
// production build, so it must exist and match the sources: it is built when `.next/BUILD_ID` is
// missing or when an application source file is newer than it. Edited test files do not count.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildId = join(root, '.next', 'BUILD_ID');
const SOURCES = ['pages', 'components', 'lib', 'style', 'utils', 'public', 'next.config.js'];

const newestSource = path => {
  const stats = statSync(path);
  if (!stats.isDirectory()) return stats.mtimeMs;
  return readdirSync(path)
    .filter(name => !/\.test\.m?js$/.test(name))
    .reduce((newest, name) => Math.max(newest, newestSource(join(path, name))), stats.mtimeMs);
};

const reason = () => {
  if (!existsSync(buildId)) return 'there is no production build';
  const built = statSync(buildId).mtimeMs;
  const changed = SOURCES.map(name => join(root, name))
    .filter(path => existsSync(path))
    .some(path => newestSource(path) > built);
  return changed ? 'application sources changed after the last build' : null;
};

const why = reason();
if (why) {
  console.log(`Building the application for the end-to-end tests: ${why}.`);
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
} else {
  console.log('Using the existing production build (.next/BUILD_ID).');
}
