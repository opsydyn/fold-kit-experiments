/** Native qualification harness, not shipped CLI code; no diagram is written. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const binary = path.join(root, 'packages/foldkit-zloz-cli/dist/bin.mjs');
const fixturePath = 'packages/foldkit-zloz-cli/evidence/example.json';
const fixture = path.join(root, fixturePath);
const hash = (file) =>
  createHash('sha256')
    .update(readFileSync(path.join(root, file)))
    .digest('hex');
const before = readFileSync(fixture, 'utf8');
const check = (args, status) => {
  const result = spawnSync('node', [binary, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
    timeout: 10_000,
  });
  assert.equal(result.status, status, result.stderr);
  return { args, exit: result.status, stdout: result.stdout, stderr: result.stderr };
};
const validation = check(['validate', '--input', fixturePath], 0);
assert.deepEqual(JSON.parse(validation.stdout).summary, { nodes: 1, edges: 0 });
const rejected = check(['mermaid', 'export', '--input', fixturePath], 1);
assert.equal(JSON.parse(rejected.stdout).status, 'rejected');
const report = check(
  ['mermaid', 'export', '--input', fixturePath, '--loss-policy', 'report', '--direction', 'TB'],
  0,
);
const converted = JSON.parse(report.stdout);
assert.equal(converted.status, 'converted');
assert.equal(converted.data.identity.nodes[0].flowId, 'orders');
assert.ok(converted.data.source.startsWith('flowchart TB\n'));
const invalid = check(['mermaid', 'export', '--direction', 'TD'], 2);
assert.equal(invalid.stdout, '');
assert.equal(JSON.parse(invalid.stderr).diagnostics[0].code, 'invalid-arguments');
assert.equal(readFileSync(fixture, 'utf8'), before);
const api = readFileSync(path.join(root, 'packages/foldkit-zloz/docs/modules/CLI.html'), 'utf8');
assert.ok(api.includes('<title>CLI | Foldkit Zloz API</title>'));
assert.ok(api.includes('CliResponse'));
const files = [
  'src/index.ts',
  'src/io.ts',
  'src/protocol.ts',
  'src/bin.ts',
  'package.json',
  'evidence/example.json',
].map((file) => 'packages/foldkit-zloz-cli/' + file);
const receipt = {
  result: 'pass',
  checkedAt: new Date().toISOString(),
  node: process.version,
  bun: spawnSync('bun', ['--version'], { encoding: 'utf8' }).stdout.trim(),
  measuredParent: spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout.trim(),
  sourceHashes: Object.fromEntries(files.map((file) => [file, hash(file)])),
  fixtureUnchanged: true,
  generatedCliApi: 'Foldkit Zloz API / CLI',
  commands: [validation, rejected, report, invalid],
};
writeFileSync(
  new URL('./cli-transcript.json', import.meta.url),
  JSON.stringify(receipt, null, 2) + '\n',
);
