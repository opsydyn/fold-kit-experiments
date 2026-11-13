import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const bin = fileURLToPath(new URL('../dist/bin.mjs', import.meta.url));
const source = await readFile(
  new URL('../../foldkit-zloz/test/fixtures/ddd-audit-v1.json', import.meta.url),
  'utf8',
);
const expected = JSON.parse(
  await readFile(
    new URL('../../foldkit-zloz/test/fixtures/ddd-audit-report.json', import.meta.url),
    'utf8',
  ),
);
const directory = await mkdtemp(join(tmpdir(), 'zloz-ddd-audit-evidence-'));
const transcript = [];
// oxlint-disable-next-line linteffect/no-try-catch -- Local qualification owns and must remove its temporary rule file.
try {
  const ruleFile = join(directory, 'ddd-rules.json');
  const rules = JSON.stringify({
    version: 1,
    rules: [
      {
        architecture: { family: 'ddd', scope: 'tactical', role: 'custom', name: 'enriches' },
        sources: ['aggregate-root'],
        targets: ['domain-event'],
        label: 'Enriches',
        direction: 'directed',
      },
    ],
  });
  await writeFile(ruleFile, rules);
  const wire = JSON.parse(source);
  const custom = JSON.stringify({
    ...wire,
    graph: { ...wire.graph, edges: wire.graph.edges.filter((edge) => edge.id === 'e-custom') },
  });
  const cases = [
    {
      name: 'compatible-empty',
      args: ['ddd', 'audit'],
      input: '{"version":1,"graph":{"nodes":[],"edges":[]}}',
      code: 0,
    },
    { name: 'incompatible', args: ['ddd', 'audit'], input: source, code: 1 },
    {
      name: 'custom-compatible',
      args: ['ddd', 'audit', '--rules', ruleFile],
      input: custom,
      code: 0,
    },
    { name: 'invalid-document', args: ['ddd', 'audit'], input: '{bad', code: 2 },
    {
      name: 'invalid-rules-source',
      args: ['ddd', 'audit', '--rules', '-'],
      input: source,
      code: 2,
    },
    {
      name: 'invalid-invocation',
      args: ['ddd', 'audit', '--family', 'causal'],
      input: '',
      code: 2,
    },
  ];
  for (const runtime of ['node', 'bun']) {
    const version = spawnSync(runtime, ['--version'], { encoding: 'utf8' }).stdout.trim();
    for (const candidate of cases) {
      const result = spawnSync(runtime, [bin, ...candidate.args], {
        input: candidate.input,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
      });
      assert.equal(result.status, candidate.code);
      const invoked = candidate.name === 'invalid-invocation';
      assert.equal(invoked ? result.stdout : result.stderr, '');
      const stream = invoked ? result.stderr : result.stdout;
      assert.equal(stream.trim().split('\n').length, 1);
      const output = JSON.parse(stream);
      assert.equal(output.protocol, 'foldkit-zloz-cli/v1');
      assert.equal(output.operation, invoked ? 'invocation' : 'ddd-audit');
      if (candidate.name === 'incompatible') assert.deepEqual(output.data, expected);
      transcript.push({
        runtime,
        version,
        name: candidate.name,
        exit: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
      });
    }
  }
  assert.equal(await readFile(ruleFile, 'utf8'), rules);
  assert.equal(
    await readFile(
      new URL('../../foldkit-zloz/test/fixtures/ddd-audit-v1.json', import.meta.url),
      'utf8',
    ),
    source,
  );
  await writeFile(
    new URL('ddd-audit-results.json', import.meta.url),
    JSON.stringify(
      {
        checks:
          'real Node/Bun 0/1/2, exact core report, custom file, one JSON record, stdout/stderr isolation and unchanged inputs',
        transcript,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('DDD audit process evidence passed.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
