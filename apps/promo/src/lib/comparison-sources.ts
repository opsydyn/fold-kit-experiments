import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import type { SourceFile } from './example-project';

const defaultEntries = ['promo/src/examples/comparison/main.ts'];
const approved = ['web/src', 'promo/src/examples/comparison'];

async function maintainedAppsRoot(): Promise<string> {
  // Astro relocates this module during prerendering; find the owning source apps,
  // not a path relative to the emitted chunk or the caller's working directory.
  let directory = dirname(fileURLToPath(import.meta.url));
  while (dirname(directory) !== directory) {
    if (
      (await stat(join(directory, 'promo/src/examples/comparison/main.ts')).then(
        (file) => file.isFile(),
        () => false,
      )) &&
      (await stat(join(directory, 'web/src/apps/comparison/main.ts')).then(
        (file) => file.isFile(),
        () => false,
      ))
    )
      return directory;
    directory = dirname(directory);
  }
  throw new Error('Maintained comparison app sources could not be located');
}

export function staticImports(name: string, content: string): ReadonlyArray<string> {
  const source = ts.createSourceFile(name, content, ts.ScriptTarget.Latest, true);
  return source.statements.flatMap((statement) => {
    const specifier =
      ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)
        ? statement.moduleSpecifier
        : undefined;
    return specifier !== undefined && ts.isStringLiteral(specifier) ? [specifier.text] : [];
  });
}

export async function collectComparisonSources(
  options: Readonly<{ appsRoot?: string; entries?: ReadonlyArray<string> }> = {},
): Promise<ReadonlyArray<SourceFile>> {
  const root = await realpath(options.appsRoot ?? (await maintainedAppsRoot()));
  const roots = approved.map((path) => resolve(root, path));
  const within = (path: string) => roots.some((allowed) => path.startsWith(allowed + sep));
  const assertAllowed = (path: string) => {
    if (!within(path) || /(?:\.(?:test|stories)(?:[.-]|$)|\/app\.ts$|\.astro$)/.test(path)) {
      throw new RangeError('Comparison source is outside the approved runtime sources: ' + path);
    }
  };
  const pending = (options.entries ?? defaultEntries).map((entry) => resolve(root, entry));
  const included = new Map<string, string>();
  while (pending.length > 0) {
    const request = pending.pop();
    if (request === undefined) continue;
    assertAllowed(request);
    const candidates = extname(request) ? [request] : [request + '.ts', join(request, 'index.ts')];
    let path: string | undefined;
    for (const candidate of candidates) {
      if (
        await stat(candidate).then(
          (file) => file.isFile(),
          () => false,
        )
      ) {
        path = candidate;
        break;
      }
    }
    if (path === undefined) throw new Error('Missing comparison source: ' + request);
    assertAllowed(await realpath(path));
    if (included.has(path)) continue;
    const content = await readFile(path, 'utf8');
    included.set(path, content);
    if (path.endsWith('.css')) continue;
    for (const specifier of staticImports(path, content)) {
      if (specifier.startsWith('.')) pending.push(resolve(dirname(path), specifier));
      else if (
        isAbsolute(specifier) ||
        !/^(?:effect|foldkit)(?:\/|$)|^@opsydyn\/foldkit-viz\/|^(?:fflate|@stackblitz\/sdk)$/.test(
          specifier,
        )
      ) {
        throw new RangeError('Unresolved comparison dependency: ' + specifier);
      }
    }
  }
  return [...included]
    .map(([path, content]) => ({ name: relative(root, path).split(sep).join('/'), content }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
