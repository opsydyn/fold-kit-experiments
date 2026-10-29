// Two copies of `effect` in one program break service tags and instanceof checks (PLAN D7).
// This follows the installed packages from the root and every app, package and infra
// workspace, and fails if they can load more than one version. The infra workspaces are
// their own programs (Alchemy CLIs), but since FoldKit 0.170 and Alchemy both accept
// Effect 4.1 they share the apps' Effect, and this keeps it that way.
import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { join, sep } from 'node:path';

const root = join(import.meta.dir, '../../..');
const store = `${join(root, 'node_modules', '.bun')}${sep}`;
const modulesFolder = `${sep}node_modules${sep}`;

/** The packages linked in a node_modules folder, scoped ones included. */
const linked = (modules: string): ReadonlyArray<string> =>
  existsSync(modules)
    ? readdirSync(modules)
        .filter((name) => !name.startsWith('.'))
        .flatMap((name) =>
          name.startsWith('@')
            ? readdirSync(join(modules, name)).map((scoped) => join(modules, name, scoped))
            : [join(modules, name)],
        )
        .filter((path) => existsSync(path))
        .map((path) => realpathSync(path))
    : [];

/** A package's dependencies: linked beside it in the store, or in its own node_modules. */
const dependenciesOf = (packageDir: string): ReadonlyArray<string> =>
  packageDir.startsWith(store)
    ? linked(packageDir.slice(0, packageDir.lastIndexOf(modulesFolder) + modulesFolder.length))
    : linked(join(packageDir, 'node_modules'));

type Manifest = { readonly name?: unknown; readonly version?: unknown };

/** The version of `effect` a package folder holds, if it is `effect`. */
const effectVersion = async (packageDir: string): Promise<string | undefined> => {
  const manifest: Manifest = await Bun.file(join(packageDir, 'package.json')).json();
  return manifest.name === 'effect' && typeof manifest.version === 'string'
    ? manifest.version
    : undefined;
};

const workspaces = ['apps', 'packages', 'infra'].flatMap((folder) =>
  readdirSync(join(root, folder))
    .map((name) => join(root, folder, name))
    .filter((dir) => existsSync(join(dir, 'package.json'))),
);

const seen = new Set<string>();
const versions = new Set<string>();
const queue = [root, ...workspaces];
for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
  if (!seen.has(next)) {
    seen.add(next);
    const version = await effectVersion(next);
    if (version !== undefined) versions.add(version);
    queue.push(...dependenciesOf(next));
  }
}

if (versions.size !== 1) {
  console.error(
    `expected exactly one effect version, found: ${[...versions].join(', ') || 'none'}`,
  );
  process.exit(1);
}
console.log(`single effect version: ${[...versions].join('')}`);
