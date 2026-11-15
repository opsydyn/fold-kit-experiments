import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const bin = fileURLToPath(new URL('../dist/bin.mjs', import.meta.url));
const packetFile = fileURLToPath(
  new URL('../../foldkit-zloz-mermaid/test/fixtures/review-packet-v1.json', import.meta.url),
);
const text = await readFile(packetFile, 'utf8');
const original = JSON.parse(text),
  forged = JSON.parse(text);
forged.projections.selected.source += ' forged';
const rows = [];
for (const runtime of ['node', 'bun']) {
  for (const scenario of [
    { name: 'validate-file', args: ['review', 'validate', '-i', packetFile], input: '', exit: 0 },
    { name: 'inspect-stdin', args: ['review', 'inspect'], input: text, exit: 0 },
    { name: 'reject-forged', args: ['review', 'inspect'], input: JSON.stringify(forged), exit: 2 },
    {
      name: 'reject-invalid-utf8',
      args: ['review', 'validate'],
      input: Buffer.from([0xc3]),
      exit: 2,
    },
  ]) {
    const result = spawnSync(runtime, [bin, ...scenario.args], {
      input: scenario.input,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    });
    assert.equal(result.status, scenario.exit);
    assert.equal(result.stderr, '');
    const body = JSON.parse(result.stdout);
    if (body.status === 'inspected') assert.deepEqual(body.data, original);
    rows.push({
      runtime,
      scenario: scenario.name,
      exitCode: result.status,
      operation: body.operation,
      status: body.status,
      model: body.summary?.model ?? body.data?.model ?? null,
      audit: body.summary?.audit ?? body.data?.comparison.summary ?? null,
      diagnostics: body.diagnostics,
      inspectionMatchesInput: body.status === 'inspected' ? true : null,
      stderr: result.stderr,
    });
  }
}
assert.equal(await readFile(packetFile, 'utf8'), text);
await writeFile(
  new URL('review-packet-read-results.json', import.meta.url),
  JSON.stringify(
    {
      provenance:
        'Summaries of real compiled CLI stdout; complete inspected data was asserted equal to input.',
      inputPreserved: true,
      rows,
    },
    null,
    2,
  ) + '\n',
);
