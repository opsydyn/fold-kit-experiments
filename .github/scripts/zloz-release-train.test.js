import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import {
  releasePlan,
  runTrain,
  verifyPublished,
  registryRequest,
  waitForCI,
} from './zloz-release-train.mjs';

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
