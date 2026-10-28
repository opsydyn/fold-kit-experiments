/**
 * Keeps dependency versions declared once, in the root package.json catalogs.
 *
 * - A dependency used by more than one workspace must come from a catalog in every
 *   private workspace (`catalog:` or `catalog:<name>`), and the catalog must define it.
 * - Packages published to npm cannot use `catalog:`: CI publishes them with `npm publish`,
 *   which does not resolve it. They keep literal versions, which must equal a catalog's.
 * - peerDependencies are ranges chosen for consumers, so they are left alone.
 *
 *   bun tools/check-catalog.ts
 */
import { Glob } from 'bun';

type Manifest = {
  readonly name?: string;
  readonly private?: boolean;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
  readonly workspaces?: {
    readonly catalog?: Readonly<Record<string, string>>;
    readonly catalogs?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  };
};

const sections = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;

const read = async (path: string): Promise<Manifest> => Bun.file(path).json();

const root = await read('package.json');
const catalogs = {
  '': root.workspaces?.catalog ?? {},
  ...root.workspaces?.catalogs,
};

const workspaces: Array<{ readonly path: string; readonly manifest: Manifest }> = [
  { path: 'package.json', manifest: root },
];
for (const pattern of ['apps/*/package.json', 'packages/*/package.json', 'infra/*/package.json']) {
  for await (const path of new Glob(pattern).scan('.')) {
    workspaces.push({ path, manifest: await read(path) });
  }
}

/** Every declared dependency outside workspace links and peers, with where it came from. */
const declarations = workspaces.flatMap(({ path, manifest }) =>
  sections.flatMap((section) =>
    Object.entries(manifest[section] ?? {})
      .filter(([, version]) => !version.startsWith('workspace:'))
      .map(([name, version]) => ({ path, manifest, section, name, version })),
  ),
);

const usedBy = new Map<string, Set<string>>();
for (const { name, path } of declarations) {
  usedBy.set(name, (usedBy.get(name) ?? new Set()).add(path));
}

const problems: Array<string> = [];
const isPublished = (manifest: Manifest, path: string): boolean =>
  path !== 'package.json' && manifest.private !== true;

for (const { path, manifest, section, name, version } of declarations) {
  const where = `${path} ${section}.${name}`;
  const catalogName = version.startsWith('catalog:') ? version.slice('catalog:'.length) : undefined;
  if (isPublished(manifest, path)) {
    if (catalogName !== undefined) {
      problems.push(`${where}: published packages need literal versions (npm publish)`);
    } else {
      // A literal version must equal one catalog's: the default's, or a named one's (the
      // effect-three packages build with the `strict` catalog's TypeScript and oxlint).
      const defined = Object.values(catalogs).flatMap((catalog) =>
        catalog?.[name] === undefined ? [] : [catalog[name]],
      );
      if (defined.length > 0 && !defined.includes(version)) {
        problems.push(`${where}: ${version} differs from the catalogs' ${defined.join(' or ')}`);
      }
    }
    continue;
  }
  if (catalogName !== undefined) {
    if (catalogs[catalogName]?.[name] === undefined) {
      problems.push(`${where}: catalog "${catalogName || 'default'}" does not define it`);
    }
  } else if ((usedBy.get(name)?.size ?? 0) > 1) {
    problems.push(`${where}: shared by several workspaces, so declare it in a catalog`);
  }
}

if (problems.length > 0) {
  console.error(`Dependency catalog problems:\n${problems.map((line) => `  ${line}`).join('\n')}`);
  process.exit(1);
}
console.log(
  `Catalog OK: ${declarations.length} declarations across ${workspaces.length} manifests.`,
);
