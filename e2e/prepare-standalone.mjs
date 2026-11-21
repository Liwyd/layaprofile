// Completes the standalone build the way the Docker image does (see the Dockerfile): Next copies
// only the traced server files into .next/standalone, so .next/static and public are added next to
// it. The end-to-end run then starts `node .next/standalone/server.js`, the production layout,
// instead of `next start`, which does not support `output: 'standalone'`.

import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const standalone = join(root, '.next', 'standalone');

if (!existsSync(join(standalone, 'server.js'))) {
  console.error('.next/standalone/server.js is missing. Run `npm run build` first.');
  process.exit(1);
}

const copies = [
  [join(root, '.next', 'static'), join(standalone, '.next', 'static')],
  [join(root, 'public'), join(standalone, 'public')],
];

copies.forEach(([from, to]) => {
  // Replace rather than merge, so files of an older build never linger.
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
});
