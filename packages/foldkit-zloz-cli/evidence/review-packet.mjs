import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  createEventStormingPattern,
  serializeModelDocument,
  serializeGraph,
  eventStormingRelationshipRules,
  compareModelEventStormingRelationships,
} from '../../foldkit-zloz/dist/index.mjs';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const bin = fileURLToPath(new URL('../dist/bin.mjs', import.meta.url));
const prefix = 'packages/foldkit-zloz-cli/evidence/review-packet-';
const graph = createEventStormingPattern(),
  first = graph.edges[0];
assert(first);
const selected = {
  ...graph,
  edges: [
    {
      ...first,
      id: '支付:edge',
      architecture: { family: 'event-storming', role: 'custom', name: 'approves' },
    },
  ],
};
const model = {
  id: 'orders',
  name: 'Orders',
  origin: null,
  snapshot: { graph: selected, viewport: { x: 4, y: 8, zoom: 1 } },
  editions: [
    { id: 'before', name: 'Before', snapshot: { graph } },
    { id: 'after', name: 'After', snapshot: { graph: selected } },
    {
      id: 'unrelated',
      name: 'unrelated-archive-sentinel',
      snapshot: { graph: { nodes: [], edges: [] } },
    },
  ],
};
const modelText = serializeModelDocument(model);
const rules = {
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
};
const files = {
  model: modelText,
  rules: JSON.stringify(rules),
  'invalid-rules': '{"version":2,"rules":[]}',
};
for (const [name, value] of Object.entries(files))
  await writeFile(new URL(`./review-packet-${name}.json`, import.meta.url), value);
const empty = serializeModelDocument({
  id: 'empty',
  name: 'Empty',
  origin: null,
  snapshot: { graph: { nodes: [], edges: [] } },
  editions: [{ id: 'before', name: 'Before', snapshot: { graph: { nodes: [], edges: [] } } }],
});
const unsupported = serializeModelDocument({
  ...model,
  snapshot: {
    graph: { ...selected, nodes: selected.nodes.map((node) => ({ ...node, label: 'fa:house' })) },
  },
});
const nestedGraph = {
  nodes: [
    {
      id: 'boundary',
      kind: 'group',
      label: 'Platform',
      position: { x: 0, y: 0 },
      size: { width: 400, height: 300 },
      ports: [],
      architecture: { family: 'c4', role: 'software-system' },
    },
    {
      id: 'orders',
      parentId: 'boundary',
      label: 'Orders',
      position: { x: 20, y: 70 },
      size: { width: 200, height: 120 },
      ports: [],
      architecture: { family: 'c4', role: 'container', technology: 'TypeScript' },
    },
  ],
  edges: [],
};
const nested = serializeModelDocument({
  id: 'c4',
  name: 'Container review',
  origin: null,
  snapshot: { graph: nestedGraph },
  editions: [{ id: 'before', name: 'Before', snapshot: { graph: nestedGraph } }],
});
const cases = [
  {
    name: 'strict-file',
    args: ['--baseline', 'before', '-i', `${prefix}model.json`],
    input: '',
    code: 1,
    diagnostic: 'layout-omitted',
  },
  {
    name: 'report-current',
    args: ['--baseline', 'before', '--loss-policy', 'report', '--direction', 'TB'],
    code: 0,
    introduced: 1,
  },
  {
    name: 'report-edition',
    args: ['--baseline', 'before', '--edition', 'after', '--loss-policy', 'report'],
    code: 0,
    introduced: 1,
  },
  {
    name: 'same-edition',
    args: ['--baseline', 'after', '--edition', 'after', '--loss-policy', 'report'],
    code: 0,
    introduced: 0,
  },
  {
    name: 'custom-rules',
    args: ['--baseline', 'before', '--rules', `${prefix}rules.json`, '--loss-policy', 'report'],
    code: 0,
    introduced: 0,
  },
  {
    name: 'nested-c4',
    args: ['--baseline', 'before', '--loss-policy', 'report'],
    input: nested,
    code: 0,
    introduced: 0,
  },
  { name: 'empty-strict', args: ['--baseline', 'before'], input: empty, code: 0, introduced: 0 },
  {
    name: 'unknown-baseline',
    args: ['--baseline', 'missing', '--loss-policy', 'report'],
    code: 2,
    diagnostic: 'unknown-baseline',
  },
  {
    name: 'unknown-target',
    args: ['--baseline', 'before', '--edition', 'missing', '--loss-policy', 'report'],
    code: 2,
    diagnostic: 'unknown-edition',
  },
  {
    name: 'unsupported-projection',
    args: ['--baseline', 'before', '--loss-policy', 'report'],
    input: unsupported,
    code: 1,
    diagnostic: 'unsupported-label-encoding',
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
    name: 'invalid-rules',
    args: ['--baseline', 'before', '--rules', `${prefix}invalid-rules.json`],
    code: 2,
    diagnostic: 'invalid-rules',
  },
  {
    name: 'rules-stdin',
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
  {
    name: 'invalid-direction',
    args: ['--baseline', 'before', '--direction', 'TD'],
    code: 2,
    diagnostic: 'invalid-arguments',
    invocation: true,
  },
];
const runs = [],
  runtimes = {};
for (const runtime of ['node', 'bun']) {
  const version = spawnSync(runtime, ['--version'], { encoding: 'utf8' });
  assert.equal(version.status, 0);
  runtimes[runtime] = version.stdout.trim();
  for (const example of cases) {
    const result = spawnSync(runtime, [bin, 'review', 'packet', ...example.args], {
      cwd: root,
      input: example.input ?? modelText,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    });
    assert.equal(result.status, example.code, `${runtime} ${example.name}: ${result.stderr}`);
    assert.equal(example.invocation ? result.stdout : result.stderr, '');
    const response = JSON.parse(example.invocation ? result.stderr : result.stdout);
    assert.equal(response.protocol, 'foldkit-zloz-cli/v1');
    assert.equal(response.operation, example.invocation ? 'invocation' : 'review-packet');
    assert.equal(response.status, example.code === 0 ? 'created' : 'rejected');
    if (example.diagnostic)
      assert(response.diagnostics.some((item) => item.code === example.diagnostic));
    let packet = null;
    if (response.status === 'created') {
      packet = response.data;
      assert.equal(packet.format, 'foldkit-zloz-review');
      assert.equal(packet.version, 1);
      assert.equal(packet.comparison.summary.introduced, example.introduced);
      assert(!JSON.stringify(packet).includes('unrelated-archive-sentinel'));
      assert(!JSON.stringify(packet).includes(`${prefix}rules.json`));
      const editions = new Map([
        [
          packet.baseline.source.id,
          {
            id: packet.baseline.source.id,
            name: packet.baseline.source.name,
            snapshot: packet.baseline.snapshot,
          },
        ],
      ]);
      if (packet.selected.source.kind === 'edition')
        editions.set(packet.selected.source.id, {
          id: packet.selected.source.id,
          name: packet.selected.source.name,
          snapshot: packet.selected.snapshot,
        });
      const selection =
        packet.selected.source.kind === 'current'
          ? { baselineId: packet.baseline.source.id }
          : { baselineId: packet.baseline.source.id, selectedId: packet.selected.source.id };
      const reproduced = compareModelEventStormingRelationships(
        {
          ...packet.model,
          origin: null,
          snapshot: packet.selected.snapshot,
          editions: [...editions.values()],
        },
        selection,
        { rules: packet.conventions.rules },
      );
      assert.equal(reproduced.type, 'compared');
      assert.deepEqual(reproduced.comparison, packet.comparison);
      if (example.name === 'report-current') {
        assert.equal(packet.projections.selected.direction, 'TB');
        assert(
          packet.diagnostics.some(
            (item) => item.side === 'selected' && item.code === 'viewport-omitted',
          ),
        );
        assert.equal(packet.projections.selected.identity.edges[0].flowId, '支付:edge');
        if (runtime === 'node')
          await writeFile(
            new URL('./review-packet-sample.json', import.meta.url),
            JSON.stringify(packet, null, 2) + '\n',
          );
      }
      if (example.name === 'custom-rules') {
        assert.equal(packet.conventions.source, 'custom');
        assert.deepEqual(packet.conventions.rules, rules.rules);
      }
      if (example.name === 'nested-c4') {
        assert(packet.projections.selected.source.includes('subgraph'));
        assert.equal(packet.projections.selected.identity.nodes[1].parentId, 'boundary');
      }
      if (example.name === 'empty-strict') assert.deepEqual(response.diagnostics, []);
    } else assert(!('data' in response));
    runs.push({
      runtime,
      example: example.name,
      exitCode: result.status,
      response: {
        operation: response.operation,
        status: response.status,
        packet:
          packet === null
            ? null
            : {
                format: packet.format,
                version: packet.version,
                baseline: packet.baseline.source,
                selected: packet.selected.source,
                conventions: {
                  source: packet.conventions.source,
                  ruleCount: packet.conventions.rules.length,
                },
                summary: packet.comparison.summary,
                projectionOptions: packet.projectionOptions,
              },
        diagnostics: response.diagnostics.map(({ side, code, severity, subject }) => ({
          side: side ?? null,
          code,
          severity,
          subject,
        })),
      },
    });
  }
}
for (const [name, value] of Object.entries(files))
  assert.equal(
    await readFile(new URL(`./review-packet-${name}.json`, import.meta.url), 'utf8'),
    value,
  );
console.log(
  JSON.stringify(
    {
      result: 'passed',
      runtimes,
      checks: [
        'real Node/Bun executable',
        'file and stdin input',
        'atomic strict/report projection behavior',
        'audit findings do not fail artifact creation',
        'explicit/current/same selectors',
        'data-only conventions travel without file paths',
        'audit reproduced from every created JSON packet',
        'nested C4 identity and Unicode edges',
        '0/1/2 exits and JSON framing',
        'input fixture bytes unchanged',
      ],
      runs,
    },
    null,
    2,
  ),
);
