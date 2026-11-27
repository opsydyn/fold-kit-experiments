import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  installFromRegistry,
  registryRequest,
  verifyPublished,
  waitForPublication,
} from './zloz-release-train.mjs';

const version = '1.0.0-next.0';
// Each package follows its internal dependencies. Keep the new registry identity first.
const components = [
  'astro-effect-ui',
  'astro-foldkit',
  'effect-three',
  'effect-three-foldkit',
  'effect-three-rapier',
  'effect-three-troika',
  'foldkit-viz',
  'foldkit-zloz',
  'foldkit-zloz-elk',
  'foldkit-zloz-force',
  'foldkit-zloz-mermaid',
];
const names = new Set(components.map((component) => `@opsydyn/${component}`));
const repository = 'https://github.com/opsydyn/fold-kit-experiments';
const registry = 'https://registry.npmjs.org';
const packageUrl = (name) => `${registry}/${encodeURIComponent(name)}`;
const releaseUrl = (name) => `${packageUrl(name)}/${version}`;
const wait = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));
const command = (file, args, cwd) => execFileSync(file, args, { cwd, stdio: 'inherit' });
const quiet = (file, args, cwd) => execFileSync(file, args, { cwd, encoding: 'utf8' });
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');

function verifyCandidate(manifest, component, seen, snapshot) {
  assert.equal(manifest.name, `@opsydyn/${component}`);
  assert.equal(manifest.version, version);
  assert.notEqual(manifest.private, true);
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
      assert(
        !/^(workspace:|catalog:|file:|link:)/.test(spec),
        `${manifest.name} has a local ${field} entry`,
      );
      assert(!/^(@foldkit\/|foldkit$)/.test(name), `${manifest.name} declares FoldKit`);
      if (names.has(name)) {
        assert.equal(spec, version, `${manifest.name} requires an exact release peer for ${name}`);
        assert(seen.has(name), `${name} must publish before ${manifest.name}`);
      }
    }
  }
  if (component === 'astro-effect-ui') {
    assert.equal(manifest.dependencies['@effect/ui'], snapshot);
    assert.equal(manifest.publishConfig.tag, 'next');
  }
  seen.add(manifest.name);
}

async function installConsumer(directory, candidates, catalog, local) {
  mkdirSync(directory, { recursive: true });
  const dependencies = {
    astro: catalog.astro,
    effect: catalog.effect,
    three: catalog.three,
    '@effect/ui': catalog['@effect/ui'],
  };
  for (const { manifest, archive } of candidates) {
    dependencies[manifest.name] = local ? `file:${archive}` : version;
  }
  writeJson(join(directory, 'package.json'), { private: true, type: 'module', dependencies });
  const flags = ['--strict-peer-deps', '--ignore-scripts', '--no-fund', '--no-audit'];
  const resolveLock = ['install', '--package-lock-only', ...flags];
  if (local) command('npm', resolveLock, directory);
  else {
    await installFromRegistry('Effect UI next consumer', () =>
      spawnSync('npm', [...resolveLock, '--prefer-online'], { cwd: directory, encoding: 'utf8' }),
    );
  }
  command('npm', ['ci', ...flags], directory);
  const { packages } = readJson(join(directory, 'package-lock.json'));
  assert(
    !Object.keys(packages).some((key) => /(?:^|\/)node_modules\/(?:foldkit$|@foldkit\/)/.test(key)),
  );
  for (const { manifest, integrity } of candidates) {
    const installed = packages[`node_modules/${manifest.name}`];
    assert.equal(installed.version, version);
    assert.equal(installed.integrity, integrity, `Integrity mismatch for ${manifest.name}`);
    if (!local) assert.equal(new URL(installed.resolved).origin, registry);
  }
  command(
    'node',
    [
      '--input-type=module',
      '-e',
      `import assert from 'node:assert/strict';
     import astro from '@opsydyn/astro-effect-ui';
     import forwarded from '@opsydyn/astro-foldkit';
     assert.equal(astro, forwarded);
     for (const name of ${JSON.stringify([...names])}) assert(Object.keys(await import(name)).length > 0, name);
     await assert.rejects(import('@opsydyn/foldkit-zloz/foldkit'), {code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});`,
    ],
    directory,
  );
}

async function prepare(sourceSha, directory) {
  assert.match(sourceSha, /^[a-f0-9]{40}$/);
  mkdirSync(directory, { recursive: true });
  const source = join(directory, 'source');
  mkdirSync(source);
  const sourceArchive = join(directory, 'source.tar');
  command('git', ['archive', '-o', sourceArchive, sourceSha]);
  command('tar', ['-xf', sourceArchive, '-C', source]);
  const archives = join(directory, 'archives');
  mkdirSync(archives);
  const catalog = readJson(join(source, 'package.json')).workspaces.catalog;
  assert.match(
    catalog['@effect/ui'],
    /^https:\/\/pkg\.pr\.new\/Effect-TS\/ui\/@effect\/ui@[a-f0-9]{7,40}$/,
  );
  for (const component of components) {
    const path = join(source, 'packages', component, 'package.json');
    const manifest = readJson(path);
    assert.equal(manifest.name, `@opsydyn/${component}`);
    manifest.version = version;
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const name of Object.keys(manifest[field] ?? {})) {
        if (names.has(name)) manifest[field][name] = version;
      }
    }
    writeJson(path, manifest);
  }
  command('bun', ['install', '--ignore-scripts'], source);
  command('bun', ['install', '--frozen-lockfile', '--ignore-scripts'], source);
  const candidates = [];
  const seen = new Set();
  for (const component of components) {
    command('bun', ['run', '--filter', `@opsydyn/${component}`, 'build'], source);
    const folder = join(source, 'packages', component);
    const packRoot = component === 'astro-effect-ui' ? join(folder, 'dist') : folder;
    if (component === 'astro-effect-ui') {
      const path = join(packRoot, 'package.json');
      const manifest = readJson(path);
      assert.equal(manifest.private, true);
      delete manifest.private;
      manifest.repository = {
        type: 'git',
        url: `${repository}.git`,
        directory: 'packages/astro-effect-ui',
      };
      manifest.publishConfig = { access: 'public', tag: 'next' };
      writeJson(path, manifest);
    }
    const [packed] = JSON.parse(
      quiet(
        'npm',
        ['pack', '--ignore-scripts', '--json', '--pack-destination', archives],
        packRoot,
      ),
    );
    const archive = join(archives, packed.filename);
    const manifest = JSON.parse(quiet('tar', ['-xOf', archive, 'package/package.json']));
    verifyCandidate(manifest, component, seen, catalog['@effect/ui']);
    candidates.push({ component, manifest, archive, integrity: packed.integrity });
  }
  await installConsumer(join(directory, 'packed-consumer'), candidates, catalog, true);
  writeJson(join(archives, 'candidates.json'), { sourceSha, catalog, candidates });
}

async function verifyRegistry(item, read, controlSha) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const metadata = await read();
    const url = metadata?.dist.attestations?.url;
    if (url) {
      const attestations = await registryRequest(url);
      const bytes = await registryRequest(metadata.dist.tarball, fetch, wait, true);
      if (attestations && bytes) {
        return verifyPublished(item, metadata, bytes, attestations, controlSha, [
          '.github/workflows/publish.yml',
        ]);
      }
    }
    await wait(5_000);
  }
  throw new Error(`Timed out verifying registry artifact and provenance for ${item.manifest.name}`);
}

async function publish(sourceSha, directory) {
  const {
    catalog,
    candidates,
    sourceSha: stagedSha,
  } = readJson(join(directory, 'archives', 'candidates.json'));
  assert.equal(stagedSha, sourceSha);
  assert.equal(process.env.GITHUB_REPOSITORY, 'opsydyn/fold-kit-experiments');
  const controlSha = process.env.GITHUB_SHA;
  assert.match(controlSha, /^[a-f0-9]{40}$/);
  assert.deepEqual(
    candidates.map(({ component }) => component),
    components,
  );
  const seen = new Set();
  const existing = new Map();
  for (const item of candidates) {
    verifyCandidate(item.manifest, item.component, seen, catalog['@effect/ui']);
    const { name } = item.manifest;
    const metadata = await registryRequest(releaseUrl(name));
    if (metadata) await verifyRegistry(item, () => registryRequest(releaseUrl(name)), controlSha);
    const packument = await registryRequest(packageUrl(name));
    existing.set(name, { metadata, latest: packument?.['dist-tags']?.latest });
  }
  const receipts = [];
  for (const item of candidates) {
    const { name } = item.manifest;
    const previous = existing.get(name);
    const lookup = () => registryRequest(releaseUrl(name));
    if (previous.metadata === null) {
      command('npm', [
        'publish',
        item.archive,
        '--ignore-scripts',
        '--access',
        'public',
        '--tag',
        'next',
        '--provenance',
      ]);
      await waitForPublication(item.component, lookup);
    }
    const receipt = await verifyRegistry(item, lookup, controlSha);
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const tags = (await registryRequest(packageUrl(name)))?.['dist-tags'];
      if (tags?.next === version) {
        assert.equal(tags.latest, previous.latest, `Unexpected latest tag change on ${name}`);
        break;
      }
      assert(attempt < 23, `next tag is missing for ${name}`);
      await wait(5_000);
    }
    receipts.push({ ...receipt, productSourceSha: sourceSha, tag: 'next' });
    writeJson(join(directory, 'archives', 'published.json'), receipts);
    console.log(`Registry verified ${name}@${version} under next`);
  }
  await installConsumer(join(directory, 'registry-consumer'), candidates, catalog, false);
}

const [mode, sourceSha, rawDirectory] = process.argv.slice(2);
assert.match(sourceSha ?? '', /^[a-f0-9]{40}$/);
assert(rawDirectory, 'Release staging directory is required');
assert(['prepare', 'publish'].includes(mode), 'Choose prepare or publish');
const directory = resolve(rawDirectory);
if (mode === 'prepare') await prepare(sourceSha, directory);
else await publish(sourceSha, directory);
