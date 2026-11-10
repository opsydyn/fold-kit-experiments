import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  createEventStormingPattern,
  serializeModelDocument,
  serializeGraph,
  eventStormingRelationshipRules,
} from '../../foldkit-zloz/dist/index.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const bin = fileURLToPath(new URL('../dist/bin.mjs', import.meta.url));
const prefix = 'packages/foldkit-zloz-cli/evidence/relationship-comparison-';
const graph = createEventStormingPattern(),
  first = graph.edges[0],
  second = graph.edges[1];
assert(first && second);
const bad = { ...first, architecture: { family: 'event-storming', role: 'emits' } };
const before = {
  ...graph,
  edges: ['persist', 'fixed', 'removed', 'recoded'].map((id) => ({ ...bad, id })),
};
const after = {
  ...graph,
  edges: [
    { ...bad, id: 'persist', label: 'Updated label', target: second.target },
    { ...first, id: 'fixed' },
    { ...bad, id: 'added' },
    {
      ...first,
      id: 'recoded',
      architecture: { family: 'event-storming', role: 'custom', name: 'approves' },
    },
  ],
};
const model = serializeModelDocument({
  id: 'orders',
  name: 'Orders',
  snapshot: { graph: after },
  origin: null,
  editions: [
    { id: 'before', name: 'Before', snapshot: { graph: before } },
    { id: 'after', name: 'After', snapshot: { graph: after } },
    { id: 'clean', name: 'Clean', snapshot: { graph } },
  ],
});
const rules = JSON.stringify({
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
});
const files = { model, rules };
for (const [name, text] of Object.entries(files))
  await writeFile(new URL(`./relationship-comparison-${name}.json`, import.meta.url), text);

const cases = [
  {
    name: 'current-file',
    args: ['--baseline', 'before', '-i', `${prefix}model.json`],
    input: '',
    code: 1,
    summary: { introduced: 2, resolved: 3, persisting: 1 },
  },
  {
    name: 'explicit-edition-stdin',
    args: ['--baseline', 'before', '--edition', 'after'],
    code: 1,
    summary: { introduced: 2, resolved: 3, persisting: 1 },
  },
  {
    name: 'resolved',
    args: ['--baseline', 'before', '--edition', 'clean'],
    code: 0,
    summary: { introduced: 0, resolved: 4, persisting: 0 },
  },
  {
    name: 'persisting-current',
    args: ['--baseline', 'after'],
    code: 0,
    summary: { introduced: 0, resolved: 0, persisting: 3 },
  },
  {
    name: 'same-edition',
    args: ['--baseline', 'before', '--edition', 'before'],
    code: 0,
    summary: { introduced: 0, resolved: 0, persisting: 4 },
  },
  {
    name: 'reverse',
    args: ['--baseline', 'after', '--edition', 'before'],
    code: 1,
    summary: { introduced: 3, resolved: 2, persisting: 1 },
  },
  {
    name: 'shared-custom-rules',
    args: ['--baseline', 'before', '--rules', `${prefix}rules.json`],
    code: 1,
    summary: { introduced: 1, resolved: 3, persisting: 1 },
  },
  {
    name: 'unknown-baseline',
    args: ['--baseline', 'absent'],
    code: 2,
    diagnostic: 'unknown-baseline',
  },
  {
    name: 'unknown-target',
    args: ['--baseline', 'before', '--edition', 'absent'],
    code: 2,
    diagnostic: 'unknown-edition',
  },
  {
    name: 'graph-rejected',
    args: ['--baseline', 'before'],
    input: serializeGraph(graph),
    code: 2,
    diagnostic: 'model-required',
  },
  {
    name: 'invalid-json',
    args: ['--baseline', 'before'],
    input: '{bad',
    code: 2,
    diagnostic: 'invalid-json',
  },
  {
    name: 'reserved-rules-stdin',
    args: ['--baseline', 'before', '--rules', '-'],
    code: 2,
    diagnostic: 'invalid-rules',
  },
  {
    name: 'missing-baseline-argument',
    args: [],
    code: 2,
    diagnostic: 'invalid-arguments',
    invocation: true,
  },
];
const runs = [];
const runtimes = Object.fromEntries(
  ['node', 'bun'].map((runtime) => {
    const version = spawnSync(runtime, ['--version'], { encoding: 'utf8' });
    assert.equal(version.status, 0);
    return [runtime, version.stdout.trim()];
  }),
);
for (const runtime of ['node', 'bun'])
  for (const example of cases) {
    const result = spawnSync(runtime, [bin, 'relationships', 'compare', ...example.args], {
      cwd: root,
      input: example.input ?? model,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    });
    assert.equal(result.status, example.code, `${runtime} ${example.name}: ${result.stderr}`);
    assert.equal(example.invocation ? result.stdout : result.stderr, '');
    const response = JSON.parse(example.invocation ? result.stderr : result.stdout);
    assert.equal(response.protocol, 'foldkit-zloz-cli/v1');
    assert.equal(response.operation, example.invocation ? 'invocation' : 'relationships-compare');
    assert.equal(response.status, example.code === 2 ? 'rejected' : 'compared');
    if (example.summary) {
      assert.deepEqual(response.data.summary, example.summary);
      assert.equal(response.diagnostics.length, example.summary.introduced);
      assert.equal(response.data.status, example.code === 1 ? 'regressed' : 'no-new-findings');
    }
    if (example.diagnostic) assert.equal(response.diagnostics[0].code, example.diagnostic);
    if (example.name === 'current-file') {
      assert.deepEqual(response.data.selected.source, { kind: 'current' });
      assert.deepEqual(
        response.data.introduced.map(({ edgeId, code }) => [edgeId, code]),
        [
          ['added', 'incompatible-roles'],
          ['recoded', 'unknown-relationship'],
        ],
      );
      assert.deepEqual(
        response.data.resolved.map(({ edgeId }) => edgeId),
        ['fixed', 'recoded', 'removed'],
      );
      assert.equal(response.data.persisting[0].after.edgeLabel, 'Updated label');
      assert.notEqual(
        response.data.persisting[0].before.message,
        response.data.persisting[0].after.message,
      );
    }
    if (example.name === 'explicit-edition-stdin')
      assert.deepEqual(response.data.selected.source, {
        kind: 'edition',
        id: 'after',
        name: 'After',
      });
    if (example.name === 'persisting-current')
      assert.equal(response.data.selected.audit.status, 'incompatible');
    // Keep the transcript compact; tests and assertions above exercise complete reports.
    runs.push({
      runtime,
      example: example.name,
      exitCode: result.status,
      response: {
        protocol: response.protocol,
        operation: response.operation,
        status: response.status,
        data: response.data
          ? {
              modelId: response.data.modelId,
              status: response.data.status,
              baseline: response.data.baseline.source,
              selected: response.data.selected.source,
              summary: response.data.summary,
            }
          : null,
        diagnostics: response.diagnostics,
      },
    });
  }
for (const [name, text] of Object.entries(files))
  assert.equal(
    await readFile(new URL(`./relationship-comparison-${name}.json`, import.meta.url), 'utf8'),
    text,
  );
console.log(
  JSON.stringify(
    {
      result: 'passed',
      runtimes,
      checks: [
        'Node/Bun real executable',
        'explicit edition and current graph selection',
        'introduced/resolved/persisting findings',
        'same convention on both sides',
        '0/1/2 exits and single JSON framing',
        'fixture bytes unchanged during commands',
      ],
      runs,
    },
    null,
    2,
  ),
);
