// Gzipped size budgets for every published entry point of a package.
//
// Run from a package directory after it is built. Each `exports` entry is
// bundled on its own, minified, with the package's dependencies and peers left
// external, so the size is what a consumer's bundle pays for that import, shared
// chunks included. Sizes are compared with etc/bundle-budget.json; with --write
// the budgets are reset to each size plus 15% headroom, rounded up to 0.5 KB.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const packageDir = process.cwd();

interface ExportCondition {
  readonly import?: string;
}
interface PackageManifest {
  readonly name: string;
  readonly exports?: Readonly<Record<string, ExportCondition>>;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

const manifest: PackageManifest = JSON.parse(
  readFileSync(join(packageDir, 'package.json'), 'utf8'),
);
const external = [
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.peerDependencies ?? {}),
].flatMap((name) => [name, `${name}/*`]);

const entries = Object.entries(manifest.exports ?? {})
  .flatMap(([subpath, condition]) =>
    condition.import === undefined || !condition.import.endsWith('.mjs')
      ? []
      : [{ subpath, file: resolve(packageDir, condition.import) }],
  )
  .sort((a, b) => a.subpath.localeCompare(b.subpath));

const missing = entries.filter(({ file }) => !existsSync(file));
if (missing.length > 0) {
  console.error(`Build ${manifest.name} first; missing ${missing.map((m) => m.file).join(', ')}`);
  process.exit(1);
}

async function gzippedSize(file: string): Promise<number> {
  const built = await Bun.build({ entrypoints: [file], minify: true, external, target: 'browser' });
  if (!built.success) throw new AggregateError(built.logs, `could not bundle ${file}`);
  const code = (await Promise.all(built.outputs.map((output) => output.text()))).join('');
  return Bun.gzipSync(code).byteLength;
}

const sizes = new Map<string, number>();
for (const { subpath, file } of entries) sizes.set(subpath, await gzippedSize(file));

const budgetFile = join(packageDir, 'etc', 'bundle-budget.json');
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

if (process.argv.includes('--write')) {
  const budgets = Object.fromEntries(
    [...sizes].map(([subpath, size]) => [subpath, Math.ceil((size * 1.15) / 512) * 512]),
  );
  mkdirSync(join(packageDir, 'etc'), { recursive: true });
  writeFileSync(budgetFile, `${JSON.stringify(budgets, null, 2)}\n`);
  console.log(`${manifest.name}: wrote budgets for ${sizes.size} entry points.`);
  process.exit(0);
}

const budgets: Readonly<Record<string, number>> = existsSync(budgetFile)
  ? JSON.parse(readFileSync(budgetFile, 'utf8'))
  : {};
const over: string[] = [];
const unbudgeted: string[] = [];
for (const [subpath, size] of sizes) {
  const budget = budgets[subpath];
  if (budget === undefined) unbudgeted.push(subpath);
  else if (size > budget) over.push(`${subpath}: ${kb(size)} gzipped, budget ${kb(budget)}`);
}
const stale = Object.keys(budgets).filter((subpath) => !sizes.has(subpath));

if (over.length + unbudgeted.length + stale.length > 0) {
  console.error(`${manifest.name}: bundle budgets not met.`);
  for (const line of over) console.error(`  over: ${line}`);
  for (const subpath of unbudgeted) console.error(`  no budget: ${subpath}`);
  for (const subpath of stale) console.error(`  budget for a removed entry point: ${subpath}`);
  console.error(
    'Shrink the entry point, or run `bun run size:write` for a deliberate change and review the diff.',
  );
  process.exit(1);
}
const largest = [...sizes].sort((a, b) => b[1] - a[1]).slice(0, 3);
console.log(
  `${manifest.name}: ${sizes.size} entry points within budget; largest ${largest
    .map(([subpath, size]) => `${subpath} ${kb(size)}`)
    .join(', ')}.`,
);
