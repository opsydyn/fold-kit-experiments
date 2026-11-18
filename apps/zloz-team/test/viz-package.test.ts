import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { Schema } from 'effect';

import vizManifest from '../../../packages/foldkit-viz/package.json';
import coreManifest from '../../../packages/foldkit-zloz/package.json';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const maxBuffer = 5 * 1024 * 1024;
const compiler = path.join(root, 'packages/foldkit-viz/node_modules/.bin/tsc');
const PackageVersion = Schema.Struct({ version: Schema.String });
const versionAt = async (directory: string, name: string) =>
  Schema.decodeUnknownSync(Schema.fromJsonString(PackageVersion))(
    await readFile(path.join(directory, 'node_modules', name, 'package.json'), 'utf8'),
  ).version;

async function pack(directory: string, name: string, version: string) {
  const cwd = path.join(root, 'packages', name);
  await exec('bun', ['run', 'build'], { cwd, maxBuffer });
  await exec('npm', ['pack', '--ignore-scripts', '--pack-destination', directory], {
    cwd,
    maxBuffer,
  });
  return path.join(directory, `opsydyn-${name}-${version}.tgz`);
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

test('packed Viz root and orbit entries typecheck and run without FoldKit/Effect peers on Node and Bun', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'zloz-viz-headless-'));
  // oxlint-disable-next-line linteffect/no-try-catch -- Reclaim only the owned temporary consumer after native verification succeeds or fails.
  try {
    await writeFile(
      path.join(directory, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    const archive = await pack(directory, 'foldkit-viz', vizManifest.version);
    await exec('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', archive], {
      cwd: directory,
      maxBuffer,
    });
    for (const peer of ['foldkit', 'effect', '@effect/platform-browser'])
      expect(existsSync(path.join(directory, 'node_modules', peer))).toBe(false);
    await qualify(directory, 'headless', 'headless-orbit-ok');
    expect(await versionAt(directory, '@opsydyn/foldkit-viz')).toBe(vizManifest.version);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 120_000);

test('packed Viz and Zloz share the exact 0.170/4.1 parent host with independent SVG definitions', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'zloz-viz-host-'));
  // oxlint-disable-next-line linteffect/no-try-catch -- Reclaim only the owned temporary consumer after native verification succeeds or fails.
  try {
    await writeFile(
      path.join(directory, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    const viz = await pack(directory, 'foldkit-viz', vizManifest.version);
    const core = await pack(directory, 'foldkit-zloz', coreManifest.version);
    await exec(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        viz,
        core,
        'foldkit@0.170.0',
        'effect@4.1.0',
        '@effect/platform-browser@4.1.0',
      ],
      { cwd: directory, maxBuffer },
    );
    expect(await versionAt(directory, 'foldkit')).toBe('0.170.0');
    expect(await versionAt(directory, 'effect')).toBe('4.1.0');
    expect(await versionAt(directory, '@effect/platform-browser')).toBe('4.1.0');
    expect(await versionAt(directory, '@opsydyn/foldkit-viz')).toBe(vizManifest.version);
    expect(await versionAt(directory, '@opsydyn/foldkit-zloz')).toBe(coreManifest.version);
    const installed = await exec(
      'npm',
      ['ls', '--all', '--parseable', 'foldkit', 'effect', '@effect/platform-browser'],
      { cwd: directory, maxBuffer },
    );
    for (const name of ['foldkit', 'effect', '@effect/platform-browser'])
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
