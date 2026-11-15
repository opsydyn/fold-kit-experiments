// Checks astro-foldkit against each Astro major its peer range claims.
//
// Packs the built package, installs it beside each Astro major in a clean
// directory with the fixture site, builds the site, and checks that the island
// is marked to hydrate with its props, that the pre-rendered page shipped its
// HTML, and that the integration's build hook ran. Run after building
// astro-foldkit:  bun tools/astro-compat.ts [majors...]  (default 5 6 7)
//
// An island without `prerender` renders in the browser, so the check looks for
// its hydration marker and props rather than its HTML.

import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repo = resolve(import.meta.dir, '..');
const packageDir = join(repo, 'packages', 'astro-foldkit');
const fixture = join(packageDir, 'test', 'compat', 'fixture');
const work = process.env.ASTRO_COMPAT_DIR ?? join(tmpdir(), 'astro-foldkit-compat');
const majors = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['5', '6', '7'];

interface Manifest {
  readonly devDependencies: Readonly<Record<string, string>>;
}
const manifest: Manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
// The fixture uses the FoldKit and Effect versions astro-foldkit is built against.
const pinned = (name: string): string => manifest.devDependencies[name] ?? 'latest';

const run = (command: string, args: ReadonlyArray<string>, cwd: string) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: process.env });
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
};

if (!existsSync(join(packageDir, 'dist', 'index.mjs'))) {
  console.error('Build astro-foldkit first: bun run --filter @opsydyn/astro-foldkit build');
  process.exit(1);
}

rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const packed = run('bun', ['pm', 'pack', '--destination', work], packageDir);
const tarball = readdirSync(work).find((file) => file.endsWith('.tgz'));
if (!packed.ok || tarball === undefined) {
  console.error(packed.output);
  process.exit(1);
}

interface Outcome {
  readonly major: string;
  readonly astro: string;
  readonly failures: ReadonlyArray<string>;
}

const check = (major: string): Outcome => {
  const site = join(work, `astro-${major}`);
  cpSync(fixture, site, { recursive: true });
  writeFileSync(
    join(site, 'package.json'),
    `${JSON.stringify(
      {
        name: `astro-foldkit-compat-${major}`,
        private: true,
        type: 'module',
        dependencies: {
          astro: `^${major}.0.0`,
          '@opsydyn/astro-foldkit': `file:${join(work, tarball)}`,
          effect: pinned('effect'),
          foldkit: pinned('foldkit'),
        },
      },
      null,
      2,
    )}\n`,
  );
  const install = run('bun', ['install'], site);
  if (!install.ok) return { major, astro: '?', failures: [`install failed:\n${install.output}`] };
  const astro: string =
    JSON.parse(readFileSync(join(site, 'node_modules', 'astro', 'package.json'), 'utf8')).version ??
    '?';
  const build = run('bunx', ['--bun', 'astro', 'build'], site);
  if (!build.ok) return { major, astro, failures: [`build failed:\n${build.output.slice(-3000)}`] };
  const page = (name: string) => {
    const file = join(site, 'dist', name);
    return existsSync(file) ? readFileSync(file, 'utf8') : '';
  };
  const island = page('index.html');
  const prerendered = page(join('static', 'index.html')) || page('static.html');
  const failures: string[] = [];
  // A client:load island renders in the browser, so the page carries its marker and props.
  if (!island.includes('<astro-island')) failures.push('the island was not marked for hydration');
  if (!/props="[^"]*start[^"]*"/.test(island))
    failures.push("the island's props were not serialised");
  if (!prerendered.includes('Count: 7')) failures.push('the pre-rendered page has no HTML');
  if (prerendered.includes('<astro-island'))
    failures.push('the pre-rendered page ships a hydrating island');
  if (!build.output.includes('module preloads for FoldKit islands'))
    failures.push('the integration build hook did not add module preloads');
  return { major, astro, failures };
};

const outcomes = majors.map(check);
for (const { major, astro, failures } of outcomes)
  console.log(
    `Astro ${major} (${astro}): ${failures.length === 0 ? 'pass' : `FAIL\n  ${failures.join('\n  ')}`}`,
  );
process.exit(outcomes.every(({ failures }) => failures.length === 0) ? 0 : 1);
