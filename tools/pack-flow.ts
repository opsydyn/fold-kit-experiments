import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import elk from '../packages/foldkit-flow-elk/package.json';
import force from '../packages/foldkit-flow-force/package.json';
import core from '../packages/foldkit-flow/package.json';

const name = process.argv[2];
if (name !== 'foldkit-flow' && name !== 'foldkit-flow-elk' && name !== 'foldkit-flow-force')
  throw new Error('Expected a FoldKit Flow package name');
const manifests = { 'foldkit-flow': core, 'foldkit-flow-elk': elk, 'foldkit-flow-force': force };
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
