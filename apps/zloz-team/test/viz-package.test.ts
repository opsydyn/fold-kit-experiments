import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { Schema } from 'effect';

import rootManifest from '../../../package.json';

const exec = promisify(execFile);
const appDirectory = fileURLToPath(new URL('..', import.meta.url));
const maxBuffer = 5 * 1024 * 1024;
const compiler = path.join(appDirectory, 'node_modules/.bin/tsc');
const viz = '@opsydyn/foldkit-viz';
const core = '@opsydyn/foldkit-zloz';
const published = rootManifest.workspaces.catalogs.published;
const PackageVersion = Schema.Struct({ version: Schema.String });
const versionAt = async (directory: string, name: string) =>
  Schema.decodeUnknownSync(Schema.fromJsonString(PackageVersion))(
    await readFile(path.join(directory, 'node_modules', name, 'package.json'), 'utf8'),
  ).version;

async function verifyPinnedPackage(directory: string, name: keyof typeof published) {
  const installed = await versionAt(directory, name);
  const consumer = await versionAt(appDirectory, name);
  expect(installed).toBe(consumer);
  const lock = Schema.decodeUnknownSync(
    Schema.fromJsonString(
      Schema.Struct({
        packages: Schema.Record(
          Schema.String,
          Schema.Struct({ resolved: Schema.optional(Schema.String) }),
        ),
      }),
    ),
  )(await readFile(path.join(directory, 'package-lock.json'), 'utf8'));
  expect(lock.packages[`node_modules/${name}`]?.resolved).toBe(published[name]);
}
async function qualify(directory: string, fixture: 'headless' | 'host', expected: string) {
  await copyFile(
    fileURLToPath(new URL(`./fixtures/viz/${fixture}.mts`, import.meta.url)),
    path.join(directory, 'consumer.mts'),
  );
  for (const resolution of ['Bundler', 'NodeNext'])
    await exec(
      compiler,
      [
        '--noEmit',
        '--strict',
        '--exactOptionalPropertyTypes',
        '--skipLibCheck',
        '--target',
        'ES2022',
        '--lib',
        'ES2022,DOM',
        '--moduleResolution',
        resolution,
        '--module',
        resolution === 'Bundler' ? 'ESNext' : 'NodeNext',
        'consumer.mts',
      ],
      { cwd: directory, maxBuffer },
    );
  // Keep imports external so Node and Bun exercise installed exports, not a bundled workspace copy.
  await exec(
    'bun',
    ['build', '--no-bundle', '--target=node', '--outfile=consumer.mjs', 'consumer.mts'],
    { cwd: directory, maxBuffer },
  );
  for (const runtime of ['node', 'bun']) {
    const result = await exec(runtime, ['consumer.mjs'], { cwd: directory, maxBuffer });
    expect(result.stdout.trim()).toBe(expected);
  }
}

test('published Viz root and orbit entries typecheck and run without FoldKit/Effect peers on Node and Bun', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'zloz-viz-headless-'));
  // oxlint-disable-next-line linteffect/no-try-catch -- Reclaim only the owned temporary consumer after native verification succeeds or fails.
  try {
    await writeFile(
      path.join(directory, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    await exec('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', published[viz]], {
      cwd: directory,
      maxBuffer,
    });
    for (const peer of ['foldkit', 'effect', '@effect/platform-browser'])
      expect(existsSync(path.join(directory, 'node_modules', peer))).toBe(false);
    await qualify(directory, 'headless', 'headless-orbit-ok');
    await verifyPinnedPackage(directory, viz);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 120_000);

test('published Viz and Zloz share the pinned Effect UI host with independent SVG definitions', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'zloz-viz-host-'));
  // oxlint-disable-next-line linteffect/no-try-catch -- Reclaim only the owned temporary consumer after native verification succeeds or fails.
  try {
    await writeFile(
      path.join(directory, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    await exec(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        published[viz],
        published[core],
        rootManifest.workspaces.catalog['@effect/ui'],
        `effect@${rootManifest.workspaces.catalog.effect}`,
      ],
      { cwd: directory, maxBuffer },
    );
    expect(existsSync(path.join(directory, 'node_modules', 'foldkit'))).toBe(false);
    expect(await versionAt(directory, 'effect')).toBe(rootManifest.workspaces.catalog.effect);
    await verifyPinnedPackage(directory, viz);
    await verifyPinnedPackage(directory, core);
    const installed = await exec('npm', ['ls', '--all', '--parseable', '@effect/ui', 'effect'], {
      cwd: directory,
      maxBuffer,
    });
    for (const name of ['@effect/ui', 'effect'])
      expect(
        installed.stdout
          .trim()
          .split('\n')
          .filter((entry) => entry.endsWith(`/node_modules/${name}`)).length,
      ).toBe(1);
    await qualify(directory, 'host', 'packed-zloz-orbit-host-ok');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 120_000);
