import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const bin = fileURLToPath(new URL('../dist/bin.mjs', import.meta.url));
const source = await readFile(
  new URL('../../foldkit-zloz/test/fixtures/c4-conversion-v1.json', import.meta.url),
  'utf8',
);
const wire = JSON.parse(source);
const directory = await mkdtemp(join(tmpdir(), 'zloz-c4-inspection-evidence-'));
const transcript = [];
// oxlint-disable-next-line linteffect/no-try-catch -- Native evidence fixtures are removed even when qualification fails.
try {
  const file = join(directory, 'receipt.json');
  await writeFile(file, source);
  const cases = [
    { name: 'valid-with-losses-stdin', args: [], input: source, code: 0 },
    { name: 'valid-file', args: ['--input', file], input: '', code: 0 },
    {
      name: 'future-version',
      args: [],
      input: JSON.stringify({ format: wire.format, version: 2, unknown: null }),
      code: 1,
      diagnostic: 'incompatible-c4-receipt',
    },
    {
      name: 'foreign-format',
      args: [],
      input: JSON.stringify({ ...wire, format: 'foldkit-zloz-ddd-conversion' }),
      code: 1,
      diagnostic: 'incompatible-c4-receipt',
    },
    {
      name: 'forged-target',
      args: [],
      input: JSON.stringify({ ...wire, document: { ...wire.document, name: 'Forged target' } }),
      code: 2,
      diagnostic: 'invalid-c4-receipt',
    },
    { name: 'invalid-json', args: [], input: '{', code: 2, diagnostic: 'invalid-json' },
    {
      name: 'invalid-utf8',
      args: [],
      input: Buffer.from([0xc3, 0x28]),
      code: 2,
      diagnostic: 'invalid-utf8',
    },
    {
      name: 'input-limit',
      args: [],
      input: 'x'.repeat(1_048_577),
      code: 2,
      diagnostic: 'input-limit',
    },
    {
      name: 'missing-file',
      args: ['--input', join(directory, 'missing.json')],
      input: '',
      code: 2,
      diagnostic: 'input-unavailable',
    },
  ];
  for (const runtime of ['node', 'bun']) {
    for (const entry of cases) {
      const run = spawnSync(runtime, [bin, 'c4', 'receipt', 'inspect', ...entry.args], {
        input: entry.input,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
        maxBuffer: 4 * 1024 * 1024,
      });
      assert.ifError(run.error);
      assert.equal(run.status, entry.code);
      assert.equal(run.stderr, '');
      assert.equal(run.stdout.trim().split('\n').length, 1);
      const response = JSON.parse(run.stdout);
      assert.equal(response.protocol, 'foldkit-zloz-cli/v1');
      assert.equal(response.operation, 'c4-receipt-inspect');
      if (entry.code === 0) {
        assert.equal(response.status, 'inspected');
        assert.deepEqual(response.data.provenance, wire.source);
        assert.deepEqual(response.data.target, wire.document);
        assert.deepEqual(response.data.choices, wire.options);
        assert.equal(response.data.authority, 'read-only-evidence');
        assert.deepEqual(
          response.data.changes.nodes.map((node) => node.id),
          ['event', 'system'],
        );
        assert.equal(response.data.changes.edges[0].id, 'emits');
        assert.ok(response.data.losses.some((loss) => loss.code === 'parent-constraints-removed'));
        assert.ok(response.diagnostics.every((diagnostic) => diagnostic.severity === 'loss'));
        if (runtime === 'node' && entry.name === 'valid-with-losses-stdin')
          await writeFile(new URL('c4-receipt-inspection.json', import.meta.url), run.stdout);
      } else {
        assert.equal(response.status, 'rejected');
        assert.equal(response.data, undefined);
        assert.equal(response.diagnostics[0].code, entry.diagnostic);
      }
      transcript.push({
        runtime,
        case: entry.name,
        exit: run.status,
        status: response.status,
        diagnostics: response.diagnostics.map((diagnostic) => diagnostic.code),
        changes: response.data
          ? { nodes: response.data.changes.nodes.length, edges: response.data.changes.edges.length }
          : null,
      });
    }
  }
  assert.equal(await readFile(file, 'utf8'), source);
  await writeFile(
    new URL('c4-receipt-inspect-results.json', import.meta.url),
    JSON.stringify({ result: 'passed', sourceUnchanged: true, cases: transcript }, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({ result: 'passed', cases: transcript.length, sourceUnchanged: true }),
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
