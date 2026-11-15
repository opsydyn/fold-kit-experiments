import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const bin = fileURLToPath(new URL('../dist/bin.mjs', import.meta.url));
const fixture = new URL('../../foldkit-zloz/test/fixtures/ddd-review-model.json', import.meta.url);
const input = await readFile(fixture, 'utf8');
const directory = await mkdtemp(join(tmpdir(), 'zloz-ddd-comparison-'));
const transcript = [];
// oxlint-disable-next-line linteffect/no-try-catch -- Qualification owns and cleans its temporary data-only catalogue.
try {
  const rulesFile = join(directory, 'ddd-rules.json');
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
  await writeFile(rulesFile, rules);
  const cases = [
    { name: 'regression', args: ['--baseline', 'ddd-before'], input, code: 1 },
    {
      name: 'persisting-incompatibility',
      args: ['--baseline', 'ddd-before', '--edition', 'ddd-before'],
      input,
      code: 0,
    },
    {
      name: 'custom-convention',
      args: ['--baseline', 'ddd-before', '--rules', rulesFile],
      input,
      code: 0,
    },
    { name: 'unknown-baseline', args: ['--baseline', 'missing'], input, code: 2 },
    {
      name: 'unknown-target',
      args: ['--baseline', 'ddd-before', '--edition', 'missing'],
      input,
      code: 2,
    },
    {
      name: 'model-required',
      args: ['--baseline', 'ddd-before'],
      input: '{"version":1,"graph":{"nodes":[],"edges":[]}}',
      code: 2,
    },
    { name: 'malformed-input', args: ['--baseline', 'ddd-before'], input: '{bad', code: 2 },
    { name: 'missing-baseline', args: [], input, code: 2, invocation: true },
  ];
  for (const runtime of ['node', 'bun']) {
    const version = spawnSync(runtime, ['--version'], { encoding: 'utf8' }).stdout.trim();
    for (const candidate of cases) {
      const result = spawnSync(runtime, [bin, 'ddd', 'compare', ...candidate.args], {
        input: candidate.input,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
      });
      assert.equal(result.status, candidate.code, `${runtime} ${candidate.name}: ${result.stderr}`);
      assert.equal(candidate.invocation ? result.stdout : result.stderr, '');
      const stream = candidate.invocation ? result.stderr : result.stdout;
      assert.equal(stream.trim().split('\n').length, 1);
      const output = JSON.parse(stream);
      assert.equal(output.operation, candidate.invocation ? 'invocation' : 'ddd-compare');
      if (candidate.name === 'regression') {
        assert.deepEqual(output.data.summary, { introduced: 2, resolved: 3, persisting: 1 });
        assert.deepEqual(
          output.data.introduced.map((e) => [e.edgeId, e.code]),
          [
            ['new', 'unknown-relationship'],
            ['recoded', 'unknown-relationship'],
          ],
        );
        assert.deepEqual(
          output.data.resolved.map((e) => [e.edgeId, e.code]),
          [
            ['fixed', 'incompatible-roles'],
            ['recoded', 'incompatible-roles'],
            ['removed', 'same-context'],
          ],
        );
      }
      if (candidate.name === 'persisting-incompatibility') {
        assert.equal(output.data.status, 'no-new-findings');
        assert.equal(output.data.selected.audit.status, 'incompatible');
        assert.deepEqual(output.data.summary, { introduced: 0, resolved: 0, persisting: 4 });
      }
      if (candidate.name === 'custom-convention')
        assert.deepEqual(output.data.summary, { introduced: 0, resolved: 2, persisting: 2 });
      if (candidate.code === 2) assert.equal(output.data, undefined);
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
  assert.equal(await readFile(fixture, 'utf8'), input);
  assert.equal(await readFile(rulesFile, 'utf8'), rules);
  await writeFile(
    new URL('./ddd-comparison-results.json', import.meta.url),
    JSON.stringify(
      {
        checks:
          'Node/Bun regression vs incompatibility, 0/1/2 exits, custom rules, selectors, input validation, output framing and source preservation',
        transcript,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('DDD comparison process evidence passed.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
