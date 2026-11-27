// Build and import the two packed Astro packages in isolated consumer projects.

import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import workspace from '../package.json' with { type: 'json' };

const repo = resolve(import.meta.dir, '..');
const wrapper = join(repo, 'packages', 'astro-foldkit');
const renderer = join(repo, 'packages', 'astro-effect-ui', 'dist');
const fixture = join(wrapper, 'test', 'compat', 'fixture');
const majors = process.argv.slice(2);
if (majors.length === 0) majors.push('5', '6', '7');
if (majors.some((major) => !['5', '6', '7'].includes(major)))
  throw new Error('Expected Astro major versions 5, 6, or 7.');

const run = (command: string, args: readonly string[], cwd: string) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: process.env });
  if (result.error)
    throw new Error(`Could not start ${command} in ${cwd}`, { cause: result.error });
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(' ')} failed:\n${result.stdout ?? ''}${result.stderr ?? ''}`,
    );
};

const pack = (directory: string, work: string, name: string) => {
  run('bun', ['pm', 'pack', '--destination', work], directory);
  const archive = readdirSync(work).find(
    (file) => file.startsWith(`opsydyn-${name}-`) && file.endsWith('.tgz'),
  );
  if (!archive) throw new Error(`Missing package archive for ${name}.`);
  return `file:${join(work, archive)}`;
};

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function qualify() {
  const work = mkdtempSync(
    join(process.env.ASTRO_COMPAT_DIR ?? tmpdir(), 'astro-effect-ui-compat-'),
  );
  const catalog = workspace.workspaces.catalog;
  let failed = false;

  // oxlint-disable-next-line linteffect/no-try-catch -- Keep each install isolated and reclaim its scratch space on failure.
  try {
    const adapterArchive = pack(wrapper, work, 'astro-foldkit');
    const rendererArchive = pack(renderer, work, 'astro-effect-ui');
    for (const major of majors) {
      const site = join(work, `astro-${major}`);
      // oxlint-disable-next-line linteffect/no-try-catch -- Report each supported consumer independently and reclaim its install.
      try {
        cpSync(fixture, site, { recursive: true });
        writeFileSync(
          join(site, 'package.json'),
          JSON.stringify({
            name: 'astro-effect-ui-consumer',
            private: true,
            type: 'module',
            overrides: { '@opsydyn/astro-effect-ui': rendererArchive },
            dependencies: {
              astro: major === '7' ? catalog.astro : `^${major}.0.0`,
              '@opsydyn/astro-foldkit': adapterArchive,
              '@opsydyn/astro-effect-ui': rendererArchive,
              '@effect/ui': catalog['@effect/ui'],
              effect: catalog.effect,
            },
          }),
        );
        run('bun', ['install', '--ignore-scripts', '--prefer-offline'], site);
        const lock = readFileSync(join(site, 'bun.lock'), 'utf8');
        assert(!lock.includes('"foldkit":'), 'Consumer lockfile resolves a FoldKit runtime.');
        run(
          'node',
          [
            '--input-type=module',
            '-e',
            `
          import assert from 'node:assert/strict';
          import forwarded from '@opsydyn/astro-foldkit';
          import direct from '@opsydyn/astro-effect-ui';
          import { astroComponent as a } from '@opsydyn/astro-foldkit/component';
          import { astroComponent as b } from '@opsydyn/astro-effect-ui/component';
          assert.equal(forwarded, direct);
          assert.equal(a, b);
          import fs from 'node:fs';
          const installed = (name) => JSON.parse(fs.readFileSync('node_modules/@opsydyn/' + name + '/package.json', 'utf8'));
          assert.equal(installed('astro-foldkit').dependencies['@opsydyn/astro-effect-ui'], installed('astro-effect-ui').version);
          assert.equal(forwarded().name, 'astro-effect-ui');
        `,
          ],
          site,
        );
        const types = 'consumer.mts';
        writeFileSync(
          join(site, types),
          `import effectUi, { type EffectUiOptions } from '@opsydyn/astro-foldkit';
import { astroComponent, type IslandProps } from '@opsydyn/astro-foldkit/component';
import direct from '@opsydyn/astro-effect-ui';
const options: EffectUiOptions = { interaction: false };
const props: IslandProps = { start: 7 };
const compatible: typeof direct = effectUi;
void [compatible(options), astroComponent, props];
`,
        );
        run(
          'node',
          [
            join(wrapper, 'node_modules', 'typescript', 'bin', 'tsc'),
            '--module',
            'NodeNext',
            '--moduleResolution',
            'NodeNext',
            '--noEmit',
            '--strict',
            '--skipLibCheck',
            types,
          ],
          site,
        );
        // Run Astro with the workspace's Bun. Node still checks the published ESM
        // imports and declarations independently of the site build.
        run('bun', ['node_modules/.bin/astro', 'build'], site);
        const island = readFileSync(join(site, 'dist', 'index.html'), 'utf8');
        const staticPage = readFileSync(join(site, 'dist', 'static', 'index.html'), 'utf8');
        assert(island.includes('Count: 3'), 'Interactive SSR markup is missing.');
        assert(island.includes('<astro-island'), 'Interactive island is missing.');
        assert(island.includes('data-effect-ui-state'), 'Effect UI state is missing.');
        assert(staticPage.includes('Count: 7'), 'Static SSR markup is missing.');
        assert(!staticPage.includes('<astro-island'), 'Static page has an interactive island.');
        console.log(`Astro ${major}: packed imports, SSR and deferred hydration markup passed.`);
      } catch (error) {
        failed = true;
        console.error(`Astro ${major}: ${String(error)}`);
      } finally {
        rmSync(site, { recursive: true, force: true });
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return failed ? 1 : 0;
}

process.exitCode = qualify();
