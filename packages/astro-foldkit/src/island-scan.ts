import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Astro's client dependency scan reads only component and page files (.astro, .jsx, .tsx, ...).
// A FoldKit island is a .ts module, so Vite would otherwise meet an island's imports only when a
// browser first loads it, re-optimise mid-request, answer with 504 "Outdated Optimize Dep" and
// reload the page.
const scannable = /\.[cm]?[jt]s$/;
const declaration = /\.d\.[cm]?ts$/;
const definesFoldkitEntry = /@opsydyn\/astro-foldkit\/define-(?:app|page)['"]/;
const globSyntax = /[()[\]{}*?!+@]/g;

const listFiles = (directory: string): ReadonlyArray<string> =>
  existsSync(directory) ? readdirSync(directory, { recursive: true, encoding: 'utf8' }) : [];

const isCandidate = (path: string): boolean =>
  scannable.test(path) && !declaration.test(path) && !path.split(sep).includes('node_modules');

const toEntryPattern = (root: string, file: string): string =>
  relative(root, file).split(sep).join('/').replace(globSyntax, '\\$&');

/** Root-relative glob patterns, escaped, for the source modules that define FoldKit islands or pages. */
export const findIslandEntries = (root: string, srcDir: string): ReadonlyArray<string> =>
  listFiles(srcDir)
    .filter(isCandidate)
    .map((path) => join(srcDir, path))
    .filter((file) => definesFoldkitEntry.test(readFileSync(file, 'utf8')))
    .map((file) => toEntryPattern(root, file));

type EnvironmentConfig = Readonly<{ optimizeDeps: Readonly<{ entries: ReadonlyArray<string> }> }>;

export type IslandScanPlugin = Readonly<{
  name: 'astro-foldkit:island-scan';
  configEnvironment: (name: string) => EnvironmentConfig | undefined;
}>;

export const islandScanPlugin = (root: string, srcDir: string): IslandScanPlugin => ({
  name: 'astro-foldkit:island-scan',
  configEnvironment: (name) => {
    if (name !== 'client') return undefined;
    const entries = findIslandEntries(root, srcDir);
    return entries.length === 0 ? undefined : { optimizeDeps: { entries } };
  },
});
