import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  releasePlan,
  runTrain,
  verifyPublished,
  registryRequest,
  waitForCI,
  assertControllerSource,
  loadCandidates,
  waitForPublication,
  installFromRegistry,
} from './zloz-release-train.mjs';

test('registry installs wait through ETARGET processing without retrying publication', async () => {
  let elapsed = 0;
  let installs = 0;
  const result = await installFromRegistry(
    'foldkit-zloz-force',
    async () => {
      installs += 1;
      return elapsed < 180_000
        ? {
            status: 1,
            stdout: '',
            stderr: 'npm error code ETARGET\nnpm error notarget No matching version found',
          }
        : { status: 0, stdout: 'installed', stderr: '' };
    },
    async (ms) => {
      elapsed += ms;
    },
  );
  expect(result.status).toBe(0);
  expect(elapsed).toBe(180_000);
  expect(installs).toBe(37);
});

test('immediately installable versions require no retry delay', async () => {
  let waits = 0;
  const installed = { status: 0, stdout: 'installed', stderr: '' };
  expect(
    await installFromRegistry(
      'foldkit-zloz',
      async () => installed,
      async () => {
        waits += 1;
      },
    ),
  ).toEqual(installed);
  expect(waits).toBe(0);
});

test('incompatible or forbidden installs fail immediately', async () => {
  for (const code of ['ERESOLVE', 'E403', 'EINTEGRITY']) {
    let installs = 0;
    let waits = 0;
    await expect(
      installFromRegistry(
        'foldkit-zloz',
        async () => {
          installs += 1;
          return { status: 1, stdout: '', stderr: `npm error code ${code}` };
        },
        async () => {
          waits += 1;
        },
      ),
    ).rejects.toThrow(code);
    expect(installs).toBe(1);
    expect(waits).toBe(0);
  }
});

test('install processing retries are bounded and spawn failures are not retried', async () => {
  let installs = 0;
  let elapsed = 0;
  await expect(
    installFromRegistry(
      'foldkit-zloz',
      async () => {
        installs += 1;
        return { status: 1, stdout: '', stderr: 'npm error code ETARGET' };
      },
      async (ms) => {
        elapsed += ms;
      },
    ),
  ).rejects.toThrow('Registry install propagation timed out');
  expect(installs).toBe(120);
  expect(elapsed).toBe(600_000);
  let waits = 0;
  await expect(
    installFromRegistry(
      'foldkit-zloz',
      async () => ({ error: new Error('npm unavailable'), status: null, stdout: '', stderr: '' }),
      async () => {
        waits += 1;
      },
    ),
  ).rejects.toThrow('npm unavailable');
  expect(waits).toBe(0);
  await expect(
    installFromRegistry(
      'foldkit-zloz',
      async () => ({ status: null, stdout: '', stderr: 'npm error code ETARGET' }),
      async () => {
        waits += 1;
      },
    ),
  ).rejects.toThrow('Registry install failed');
  expect(waits).toBe(0);
});

test('npm processing beyond two minutes remains read-only and can complete unattended', async () => {
  let elapsed = 0;
  const metadata = { name: '@opsydyn/foldkit-zloz', version: '0.6.1' };
  const observed = await waitForPublication(
    'foldkit-zloz',
    async () => (elapsed < 180_000 ? null : metadata),
    async (ms) => {
      elapsed += ms;
    },
  );
  expect(observed).toEqual(metadata);
  expect(elapsed).toBe(180_000);
});

test('already-visible metadata returns without a polling delay', async () => {
  let waits = 0;
  const metadata = { version: '0.6.1' };
  expect(
    await waitForPublication(
      'foldkit-zloz',
      async () => metadata,
      async () => {
        waits += 1;
      },
    ),
  ).toEqual(metadata);
  expect(waits).toBe(0);
});

test('registry processing has a bounded ten-minute delay budget', async () => {
  let reads = 0;
  let elapsed = 0;
  await expect(
    waitForPublication(
      'foldkit-zloz-elk',
      async () => {
        reads += 1;
        return null;
      },
      async (ms) => {
        elapsed += ms;
      },
    ),
  ).rejects.toThrow('Registry metadata propagation timed out: foldkit-zloz-elk');
  expect(reads).toBe(120);
  expect(elapsed).toBe(600_000);
});

test('permanent registry read failures stop immediately rather than becoming absence', async () => {
  let waits = 0;
  await expect(
    waitForPublication(
      'foldkit-zloz',
      async () => {
        throw new Error('Registry HTTP 403');
      },
      async () => {
        waits += 1;
      },
    ),
  ).rejects.toThrow('Registry HTTP 403');
  expect(waits).toBe(0);
});

test('delayed processing does not repeat an upload or advance before verification', async () => {
  const events = [];
  const io = transport(events);
  let elapsed = 0;
  io.waitForPublication = (item) =>
    waitForPublication(
      item.component,
      async () => (item.component === names[0] && elapsed < 180_000 ? null : metadata(item)),
      async (ms) => {
        elapsed += ms;
      },
    );
  await runTrain(plan(), io);
  expect(elapsed).toBe(180_000);
  expect(events.filter((event) => event.startsWith('publish:'))).toEqual(
    names.map((name) => `publish:${name}`),
  );
  expect(events.indexOf('audit:foldkit-zloz')).toBeLessThan(
    events.indexOf('publish:foldkit-zloz-elk'),
  );
});

test('release CI must succeed on the exact source; pending is polled and failures stop', async () => {
  let reads = 0;
  await waitForCI(
    'a'.repeat(40),
    async () => ({
      workflow_runs: [
        { head_sha: 'b'.repeat(40), status: 'completed', conclusion: 'success' },
        {
          head_sha: 'a'.repeat(40),
          status: ++reads === 1 ? 'in_progress' : 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/qualified-source',
        },
      ],
    }),
    async () => {},
  );
  expect(reads).toBe(2);
  await expect(
    waitForCI(
      'a'.repeat(40),
      async () => ({
        workflow_runs: [
          {
            head_sha: 'a'.repeat(40),
            status: 'completed',
            conclusion: 'failure',
            html_url: 'https://github.com/failed-source',
          },
        ],
      }),
      async () => {},
    ),
  ).rejects.toThrow('Exact-source CI failed');
});

const sha = 'a'.repeat(40);
const repository = 'https://github.com/opsydyn/fold-kit-experiments';
const names = ['foldkit-zloz', 'foldkit-zloz-elk', 'foldkit-zloz-force', 'foldkit-zloz-mermaid'];
const version = '0.6.1';

test('stdin imports do not execute the native CLI or resolve stdin as a file', () => {
  const module = new URL('./zloz-release-train.mjs', import.meta.url).href;
  const result = spawnSync('node', ['--input-type=module', '-'], {
    input: `await import(${JSON.stringify(module)}); console.log('imported');`,
    encoding: 'utf8',
  });
  expect({ status: result.status, stdout: result.stdout, stderr: result.stderr }).toEqual({
    status: 0,
    stdout: 'imported\n',
    stderr: '',
  });
});

test('controller recovery preserves tagged package/build input identity and honest provenance', () => {
  const controller = 'b'.repeat(40);
  assertControllerSource(controller, sha, ['.github/workflows/zloz-release-train.yml']);
  const recovered = releasePlan(
    candidates(),
    controller,
    names.map(() => sha),
    [true, true],
    sha,
  );
  expect(recovered).toMatchObject({ sourceSha: controller, releaseSha: sha });
  const candidate = candidates()[0];
  expect(() =>
    verifyPublished(candidate, metadata(candidate), bytes, attestations(candidate), controller),
  ).toThrow();
  for (const path of [
    'packages/foldkit-zloz/README.md',
    'packages/foldkit-zloz/src/index.ts',
    'bun.lock',
    'package.json',
    'tools/pack-zloz.ts',
    '.github/workflows/ci.yml',
  ])
    expect(() => assertControllerSource(controller, sha, [path])).toThrow('Controller differs');
  expect(() =>
    releasePlan(
      candidates(),
      controller,
      names.map(() => controller),
      [true, true],
      sha,
    ),
  ).toThrow();
});

test('qualification guards and retains all archives despite subsequent core rebuild cleanup', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const directory = mkdtempSync(join(tmpdir(), 'zloz-qualification-command-'));
  const log = join(directory, 'calls');
  const wrapper = join(directory, 'bun');
  mkdirSync(join(directory, 'tools'));
  writeFileSync(
    join(directory, 'tools/check-package-identity.ts'),
    readFileSync(join(root, 'tools/check-package-identity.ts')),
  );
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'));
  mkdirSync(join(directory, 'expected'));
  for (const item of candidates()) {
    const path = join(directory, 'packages', item.component);
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, 'package.json'), JSON.stringify(item.manifest));
  }
  writeFileSync(
    wrapper,
    `#!/bin/bash
set -eu
if [ "$1" = tools/check-package-identity.ts ]; then
  printf 'guard:%s\\n' "\${REQUESTED_PACKAGE-unset}" >> "$TRAIN_TEST_LOG"
  exec "$TRAIN_TEST_BUN" "$@"
fi
if [ "$1" = run ] && [ "$2" = --filter ] && [ "$4" = pack:check ]; then
  printf 'pack:%s\\n' "$3" >> "$TRAIN_TEST_LOG"
  component="\${3#@opsydyn/}"
  rm -rf packages/foldkit-zloz/dist
  mkdir -p "packages/$component/dist/pack" "$component-stage/package"
  cp "packages/$component/package.json" "$component-stage/package/package.json"
  printf 'checked:%s' "$component" > "$component-stage/package/README.md"
  tar -czf "packages/$component/dist/pack/opsydyn-$component-$TRAIN_TEST_VERSION.tgz" -C "$component-stage" package
  cp "packages/$component/dist/pack/opsydyn-$component-$TRAIN_TEST_VERSION.tgz" expected/
  rm -rf "$component-stage"
  exit 0
fi
exit 99
`,
  );
  chmodSync(wrapper, 0o755);
  const workflow = Bun.YAML.parse(
    readFileSync(join(root, '.github/workflows/zloz-release-train.yml'), 'utf8'),
  );
  const step = workflow.jobs.train.steps.find(
    (entry) => entry.name === 'Qualify all candidate archives before publishing',
  );
  const env = {
    ...process.env,
    PATH: `${directory}:${process.env.PATH}`,
    TRAIN_TEST_BUN: process.execPath,
    TRAIN_TEST_LOG: log,
    TRAIN_TEST_VERSION: version,
  };
  delete env.REQUESTED_PACKAGE;
  const result = spawnSync('bash', ['-e', '-c', step.run], {
    cwd: directory,
    env,
    encoding: 'utf8',
  });
  const calls = readFileSync(log, 'utf8').trim().split('\n');
  expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: '' });
  expect(calls).toEqual(names.flatMap((name) => [`guard:${name}`, `pack:@opsydyn/${name}`]));
  expect(
    existsSync(
      join(directory, 'packages/foldkit-zloz/dist/pack', `opsydyn-foldkit-zloz-${version}.tgz`),
    ),
  ).toBe(false);
  for (const component of names) {
    const filename = `opsydyn-${component}-${version}.tgz`;
    const retained = join(directory, 'dist/zloz-release/candidates', filename);
    expect(existsSync(retained)).toBe(true);
    expect(readFileSync(retained)).toEqual(readFileSync(join(directory, 'expected', filename)));
  }
  const loaded = loadCandidates(plan(), join(directory, 'dist/zloz-release'));
  expect(loaded.map((item) => item.manifest.name)).toEqual(names.map((name) => `@opsydyn/${name}`));
  for (const item of loaded)
    expect(item.integrity).toBe(
      `sha512-${createHash('sha512')
        .update(
          readFileSync(join(directory, 'expected', `opsydyn-${item.component}-${version}.tgz`)),
        )
        .digest('base64')}`,
    );
  expect(
    releasePlan(
      loaded,
      sha,
      names.map(() => sha),
      [true, true],
    ).version,
  ).toBe(version);
  rmSync(directory, { recursive: true, force: true });
}, 30_000);

test('real preflight checks both CI sources and rejects modified tagged product files', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const directory = mkdtempSync(join(tmpdir(), 'zloz-controller-preflight-'));
  const scriptDirectory = join(directory, '.github/scripts');
  mkdirSync(scriptDirectory, { recursive: true });
  writeFileSync(
    join(scriptDirectory, 'zloz-release-train.mjs'),
    readFileSync(join(root, '.github/scripts/zloz-release-train.mjs')),
  );
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
    expect(result.status).toBe(0);
    return result.stdout.trim();
  };
  for (const item of candidates()) {
    const path = join(directory, 'packages', item.component);
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, 'package.json'), JSON.stringify(item.manifest));
  }
  for (const component of ['foldkit-zloz-cli', 'foldkit-zloz-alchemy']) {
    const path = join(directory, 'packages', component);
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, 'package.json'), JSON.stringify({ private: true }));
  }
  git('init', '-q');
  git('config', 'user.name', 'Train test');
  git('config', 'user.email', 'train@example.invalid');
  git('add', '.');
  git('commit', '-qm', 'product');
  const product = git('rev-parse', 'HEAD');
  for (const name of names) git('tag', `${name}-v${version}`);
  writeFileSync(join(scriptDirectory, 'zloz-release-train.test.js'), '// controller-only repair');
  git('add', '.');
  git('commit', '-qm', 'controller repair');
  const controller = git('rev-parse', 'HEAD');
  const gh = join(directory, 'gh');
  writeFileSync(
    gh,
    `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const sha = /head_sha=([a-f0-9]+)/.exec(process.argv.join(' '))[1];
appendFileSync(process.env.TRAIN_TEST_LOG, sha+'\\n');
console.log(JSON.stringify({workflow_runs:[{head_sha:sha,status:'completed',conclusion:'success',html_url:'https://github.com/fixture/'+sha}]}));
`,
  );
  chmodSync(gh, 0o755);
  const log = join(directory, 'ci-calls');
  const env = {
    ...process.env,
    PATH: `${directory}:${process.env.PATH}`,
    TRAIN_TEST_LOG: log,
    GITHUB_REPOSITORY: 'opsydyn/fold-kit-experiments',
    GITHUB_SHA: controller,
    SOURCE_SHA: product,
  };
  const run = () =>
    spawnSync('node', [join(scriptDirectory, 'zloz-release-train.mjs'), 'preflight'], {
      cwd: directory,
      env,
      encoding: 'utf8',
    });
  const accepted = run();
  expect({ status: accepted.status, stderr: accepted.stderr }).toEqual({ status: 0, stderr: '' });
  expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([controller, product]);
  writeFileSync(join(directory, 'packages/foldkit-zloz/README.md'), 'changed product');
  git('add', 'packages/foldkit-zloz/README.md');
  git('commit', '-qm', 'forbidden product change');
  expect(git('diff', '--name-only', controller, 'HEAD')).toBe('packages/foldkit-zloz/README.md');
  env.GITHUB_SHA = git('rev-parse', 'HEAD');
  const rejected = run();
  expect(rejected.status).not.toBe(0);
  expect(rejected.stderr).toContain('Controller differs from tagged product/build inputs');
  expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([controller, product]);
  rmSync(directory, { recursive: true, force: true });
}, 30_000);
const bytes = Buffer.from('an independently checked candidate archive');
const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
const candidates = () =>
  names.map((component, index) => ({
    component,
    path: `/candidate/${component}.tgz`,
    integrity,
    manifest: {
      name: `@opsydyn/${component}`,
      version,
      peerDependencies: index === 0 ? {} : { '@opsydyn/foldkit-zloz': version },
      dependencies: component === 'foldkit-zloz-force' ? { '@opsydyn/foldkit-viz': '0.19.0' } : {},
    },
  }));
const plan = () =>
  releasePlan(
    candidates(),
    sha,
    names.map(() => sha),
    [true, true],
  );
const metadata = (candidate) => ({
  ...candidate.manifest,
  dist: {
    integrity,
    tarball: `https://registry.npmjs.org/${candidate.manifest.name}/-/archive.tgz`,
    attestations: { url: 'https://registry.npmjs.org/-/npm/v1/attestations/package' },
  },
});
const attestations = (candidate) => ({
  attestations: [
    {
      predicateType: 'https://slsa.dev/provenance/v1',
      bundle: {
        dsseEnvelope: {
          payload: Buffer.from(
            JSON.stringify({
              _type: 'https://in-toto.io/Statement/v1',
              subject: [
                {
                  name: `pkg:npm/%40opsydyn/${candidate.component}@${version}`,
                  digest: {
                    sha512: createHash('sha512').update(bytes).digest('hex'),
                  },
                },
              ],
              predicateType: 'https://slsa.dev/provenance/v1',
              predicate: {
                buildDefinition: {
                  externalParameters: {
                    workflow: { repository, path: '.github/workflows/zloz-release-train.yml' },
                  },
                  resolvedDependencies: [
                    { uri: `git+${repository}@refs/heads/main`, digest: { gitCommit: sha } },
                  ],
                },
              },
            }),
          ).toString('base64'),
        },
      },
    },
  ],
});

describe('immutable four-package release plan', () => {
  test('orders packages by dependency and rejects incomplete or incompatible families', () => {
    expect(
      releasePlan(
        candidates().reverse(),
        sha,
        names.map(() => sha),
        [true, true],
      ).candidates.map((item) => item.component),
    ).toEqual(names);
    expect(() =>
      releasePlan(
        candidates().slice(1),
        sha,
        names.map(() => sha),
        [true, true],
      ),
    ).toThrow();
    for (const mutate of [
      (items) => {
        items[1].manifest.version = '0.6.0';
      },
      (items) => {
        items[1].manifest.peerDependencies['@opsydyn/foldkit-zloz'] = '^0.6.1';
      },
      (items) => {
        items[0].manifest.name = '@opsydyn/foldkit-flow';
      },
      (items) => {
        items[0].manifest.private = true;
      },
      (items) => {
        items[2].manifest.dependencies['@opsydyn/foldkit-viz'] = 'workspace:*';
      },
      (items) => {
        items[2].manifest.dependencies['@opsydyn/foldkit-viz'] = '^0.19.0';
      },
    ]) {
      const items = candidates();
      mutate(items);
      expect(() =>
        releasePlan(
          items,
          sha,
          names.map(() => sha),
          [true, true],
        ),
      ).toThrow();
    }
    expect(() =>
      releasePlan(
        candidates(),
        'main',
        names.map(() => sha),
        [true, true],
      ),
    ).toThrow();
    expect(() =>
      releasePlan(candidates(), sha, [sha, sha, sha, 'b'.repeat(40)], [true, true]),
    ).toThrow();
    expect(() =>
      releasePlan(
        candidates(),
        sha,
        names.map(() => sha),
        [true, false],
      ),
    ).toThrow();
  });
});

describe('registry identity, bytes and structured provenance', () => {
  test('accepts exact bytes and source with a package-bound subject', () => {
    const item = candidates()[0];
    expect(verifyPublished(item, metadata(item), bytes, attestations(item), sha)).toMatchObject({
      name: '@opsydyn/foldkit-zloz',
      version,
      integrity,
      sourceSha: sha,
    });
  });
  test('rejects wrong identities, peer pins, bytes, digest, source or repository', () => {
    const item = candidates()[1];
    for (const mutate of [
      (record) => {
        record.version = '0.6.0';
      },
      (record) => {
        record.peerDependencies['@opsydyn/foldkit-zloz'] = '0.6.0';
      },
      (record) => {
        record.dist.integrity = 'sha512-invalid';
      },
      (record) => {
        record.name = '@opsydyn/foldkit-flow';
      },
    ]) {
      const record = structuredClone(metadata(item));
      mutate(record);
      expect(() => verifyPublished(item, record, bytes, attestations(item), sha)).toThrow();
    }
    expect(() =>
      verifyPublished(
        item,
        metadata(item),
        Buffer.from('different archive'),
        attestations(item),
        sha,
      ),
    ).toThrow();
    const mutateStatement = (modify) => {
      const bundle = attestations(item);
      const envelope = bundle.attestations[0].bundle.dsseEnvelope;
      const statement = JSON.parse(Buffer.from(envelope.payload, 'base64').toString());
      modify(statement);
      envelope.payload = Buffer.from(JSON.stringify(statement)).toString('base64');
      return bundle;
    };
    for (const mutate of [
      (statement) => {
        statement.subject[0].digest.sha512 = '0'.repeat(128);
      },
      (statement) => {
        statement.subject[0].name = 'pkg:npm/another-package@0.6.1';
      },
      (statement) => {
        statement.predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit = 'b'.repeat(
          40,
        );
        statement.unrelated = sha;
      },
      (statement) => {
        statement.predicate.buildDefinition.externalParameters.workflow.repository =
          'https://github.com/attacker/repo';
      },
      (statement) => {
        statement.predicate.buildDefinition.resolvedDependencies[0].uri =
          'git+https://github.com/attacker/repo@refs/heads/main';
      },
    ])
      expect(() =>
        verifyPublished(item, metadata(item), bytes, mutateStatement(mutate), sha),
      ).toThrow();
  });
});

test('registry requests bound hosts, redirects and retries; only a real 404 is absence', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return new Response('{}', { status: calls.length < 3 ? 503 : 200 });
  };
  expect(
    await registryRequest(
      'https://registry.npmjs.org/@opsydyn%2Ffoldkit-zloz/0.6.1',
      fetcher,
      async () => {},
    ),
  ).toEqual({});
  expect(calls).toHaveLength(3);
  expect(calls.every((call) => call.options.redirect === 'error')).toBe(true);
  await expect(registryRequest('https://attacker.invalid/archive', fetcher)).rejects.toThrow();
  await expect(
    registryRequest(
      'https://registry.npmjs.org/denied',
      async () => new Response('', { status: 403 }),
    ),
  ).rejects.toThrow('403');
  expect(
    await registryRequest(
      'https://registry.npmjs.org/missing',
      async () => new Response('', { status: 404 }),
    ),
  ).toBeNull();
});

const transport = (events, existing = []) => ({
  lookup: async (item) => (existing.includes(item.component) ? metadata(item) : null),
  verifyDependency: async (name, range) => {
    events.push(`dependency:${name}@${range}`);
  },
  publish: async (item) => {
    events.push(`publish:${item.component}`);
  },
  waitForPublication: async (item) => metadata(item),
  verify: async (item) => {
    events.push(`verify:${item.component}`);
    return { name: item.manifest.name };
  },
  audit: async (item) => {
    events.push(`audit:${item.component}`);
  },
  record: async (receipt) => {
    events.push(`receipt:${receipt.name}`);
  },
});

test('the actual train waits for registry verification and signature audit before advancing', async () => {
  const events = [];
  await runTrain(plan(), transport(events));
  expect(events).toEqual([
    'dependency:@opsydyn/foldkit-viz@0.19.0',
    ...names.flatMap((name) => [
      `publish:${name}`,
      `verify:${name}`,
      `audit:${name}`,
      `receipt:@opsydyn/${name}`,
    ]),
  ]);
});

test('a partial rerun verifies existing versions without republishing them', async () => {
  const events = [];
  await runTrain(plan(), transport(events, names.slice(0, 2)));
  expect(events.filter((event) => event.startsWith('publish:'))).toEqual([
    'publish:foldkit-zloz-force',
    'publish:foldkit-zloz-mermaid',
  ]);
  expect(events.indexOf('audit:foldkit-zloz-elk')).toBeLessThan(
    events.indexOf('publish:foldkit-zloz-force'),
  );
});

test('an already-published family performs no npm publication', async () => {
  const events = [];
  await runTrain(plan(), transport(events, names));
  expect(events.filter((event) => event.startsWith('publish:'))).toEqual([]);
  expect(events.filter((event) => event.startsWith('audit:'))).toHaveLength(4);
});

test('failed lookup, dependency, publication, integrity or signature audit stops subsequent writes', async () => {
  for (const boundary of [
    'lookup',
    'verifyDependency',
    'publish',
    'waitForPublication',
    'verify',
    'audit',
    'record',
  ]) {
    const events = [];
    const io = transport(events);
    io[boundary] = async () => {
      throw new Error(`failed ${boundary}`);
    };
    await expect(runTrain(plan(), io)).rejects.toThrow(`failed ${boundary}`);
    expect(events).not.toContain('publish:foldkit-zloz-elk');
  }
});

test('workflow serializes all dispatch paths and removes single Zloz publication', async () => {
  const train = Bun.YAML.parse(
    await Bun.file(new URL('../workflows/zloz-release-train.yml', import.meta.url)).text(),
  );
  expect(train.concurrency).toEqual({
    group: 'zloz-npm-release-train',
    'cancel-in-progress': false,
  });
  expect(train.on.workflow_call.inputs.source_sha.required).toBe(true);
  expect(train.jobs.train['timeout-minutes']).toBeGreaterThan(0);
  const steps = train.jobs.train.steps;
  expect(steps.find((step) => step.uses?.startsWith('actions/checkout@')).with['fetch-depth']).toBe(
    0,
  );
  expect(steps.find((step) => step.uses?.startsWith('actions/checkout@')).with.ref).toBe(
    '${{ github.sha }}',
  );
  expect(
    steps.find((step) => step.name === 'Publish and verify in dependency order').env.SOURCE_SHA,
  ).toBe('${{ inputs.source_sha }}');
  expect(steps.find((step) => step.name === 'Retain candidates and verification receipts').if).toBe(
    'always()',
  );
  const legacy = Bun.YAML.parse(
    await Bun.file(new URL('../workflows/publish.yml', import.meta.url)).text(),
  );
  expect(
    legacy.on.workflow_dispatch.inputs.package.options.filter((name) =>
      name.startsWith('foldkit-zloz'),
    ),
  ).toEqual([]);
  const release = Bun.YAML.parse(
    await Bun.file(new URL('../workflows/release-please.yml', import.meta.url)).text(),
  );
  expect(release.jobs['publish-zloz'].uses).toBe('./.github/workflows/zloz-release-train.yml');
  expect(release.jobs['publish-zloz'].needs).toBe('release');
});
