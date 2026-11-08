import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import elk from '../packages/foldkit-zloz-elk/package.json';
import force from '../packages/foldkit-zloz-force/package.json';
import mermaid from '../packages/foldkit-zloz-mermaid/package.json';
import core from '../packages/foldkit-zloz/package.json';

const name = process.argv[2];
if (
  name !== 'foldkit-zloz' &&
  name !== 'foldkit-zloz-elk' &&
  name !== 'foldkit-zloz-force' &&
  name !== 'foldkit-zloz-mermaid'
)
  throw new Error('Expected a Foldkit Zloz package name');
const manifests = {
  'foldkit-zloz': core,
  'foldkit-zloz-elk': elk,
  'foldkit-zloz-force': force,
  'foldkit-zloz-mermaid': mermaid,
};
const manifest = manifests[name];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'packages', name);
const destination = path.join(directory, 'dist', 'pack');
mkdirSync(destination, { recursive: true });
execFileSync('bun', ['pm', 'pack', '--destination', destination], {
  cwd: directory,
  stdio: 'inherit',
});
const tarball = path.join(destination, `opsydyn-${name}-${manifest.version}.tgz`);
execFileSync(
  path.join(directory, 'node_modules', '.bin', 'attw'),
  [tarball, '--profile', 'esm-only'],
  { cwd: directory, stdio: 'inherit' },
);
console.log(`Checked tarball: ${tarball}`);
