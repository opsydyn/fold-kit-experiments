import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  createEventStormingPattern,
  serializeGraph,
  eventStormingRelationshipRules,
} from '../../foldkit-zloz/dist/index.mjs';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const bin = fileURLToPath(new URL('../dist/bin.mjs', import.meta.url));
const base = 'packages/foldkit-zloz-cli/evidence/relationship-audit-';
const graph = createEventStormingPattern({ includeAggregate: true });
const first = graph.edges[0];
assert(first);
const compatible = serializeGraph(graph);
const incompatible = serializeGraph({
  ...graph,
  edges: [{ ...first, architecture: { family: 'event-storming', role: 'emits' } }],
});
const custom = serializeGraph({
  ...graph,
  edges: [
    { ...first, architecture: { family: 'event-storming', role: 'custom', name: 'approves' } },
  ],
});
const { architecture: _architecture, ...legacy } = first;
const inferred = serializeGraph({ ...graph, edges: [legacy] });
const rules =
  JSON.stringify(
    {
      version: 1,
      rules: [
        ...eventStormingRelationshipRules,
        {
          architecture: { family: 'event-storming', role: 'custom', name: 'approves' },
          sources: ['actor'],
          targets: ['command'],
          label: 'Approves',
        },
      ],
    },
    null,
    2,
  ) + '\n';
const files = { compatible, incompatible, custom, inferred, rules };
for (const [name, text] of Object.entries(files))
  await writeFile(new URL(`./relationship-audit-${name}.json`, import.meta.url), text);
const cases = [
  {
    name: 'compatible-file',
    args: ['-i', `${base}compatible.json`],
    input: '',
    code: 0,
    status: 'audited',
  },
  { name: 'incompatible-stdin', args: [], input: incompatible, code: 1, status: 'audited' },
  { name: 'inferred-stdin', args: [], input: inferred, code: 0, status: 'audited' },
  { name: 'custom-default', args: [], input: custom, code: 1, status: 'audited' },
  {
    name: 'custom-rules',
    args: ['--rules', `${base}rules.json`],
    input: custom,
    code: 0,
    status: 'audited',
  },
  { name: 'invalid-json', args: [], input: '{bad', code: 2, status: 'rejected' },
  {
    name: 'reserved-rules-stdin',
    args: ['--rules', '-'],
    input: compatible,
    code: 2,
    status: 'rejected',
  },
];
const runs = [];
for (const runtime of ['node', 'bun'])
  for (const example of cases) {
    const result = spawnSync(runtime, [bin, 'relationships', 'audit', ...example.args], {
      cwd: root,
      input: example.input,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    });
    assert.equal(result.status, example.code, `${runtime} ${example.name}: ${result.stderr}`);
    assert.equal(result.stderr, '');
    const response = JSON.parse(result.stdout);
    assert.equal(response.protocol, 'foldkit-zloz-cli/v1');
    assert.equal(response.operation, 'relationships-audit');
    assert.equal(response.status, example.status);
    if (example.name === 'compatible-file')
      assert.deepEqual(response.data.summary, {
        edges: 5,
        typed: 5,
        inferred: 0,
        unrelated: 0,
        blocked: 0,
      });
    if (example.name === 'inferred-stdin') assert.equal(response.data.summary.inferred, 1);
    if (example.name === 'custom-rules')
      assert.equal(response.data.entries[0].relationshipKey, 'custom:approves');
    runs.push({ runtime, example: example.name, exitCode: result.status, response });
  }
for (const [name, text] of Object.entries(files))
  assert.equal(
    await readFile(new URL(`./relationship-audit-${name}.json`, import.meta.url), 'utf8'),
    text,
  );
console.log(
  JSON.stringify(
    {
      result: 'passed',
      checks: [
        'Node/Bun real executable',
        'file and stdin documents',
        'typed/inferred/blocked classification',
        'custom data-only conventions',
        '0/1/2 exit and JSON framing',
        'input fixtures unchanged',
      ],
      runs,
    },
    null,
    2,
  ),
);
