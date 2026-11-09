/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Verifies the literal public graph geometry property. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse as officialParse } from '@mermaid-js/parser';
import { createEditor, updateEditor, serializeGraph } from '@opsydyn/foldkit-zloz';
import { parseFlowchart } from 'mermaid-ast/parser';
import { renderFlowchart } from 'mermaid-ast/renderer';

import { importFlowchart, exportFlowchart } from '../dist/spike.js';

const corpus = JSON.parse(
  readFileSync(new URL('../fixtures/corpus.json', import.meta.url), 'utf8'),
);
const facts = (graph) => ({
  nodes: graph.nodes
    .map(({ id, label, ports, appearance }) => ({
      id,
      label,
      outline: appearance?.shape ?? 'rectangle',
      ports: ports.map(({ id, kind }) => ({ id, kind })).sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id)),
  edges: graph.edges
    .map(({ id, source, target, label }) => ({ id, source, target, label: label ?? '' }))
    .sort((a, b) => a.id.localeCompare(b.id)),
});

for (const fixture of corpus)
  test(fixture.id, async () => {
    const result = await importFlowchart(fixture.source, { lossPolicy: 'report' });
    assert.equal(result.status, fixture.expected);
    const losses = [
      ...new Set(
        result.diagnostics.filter(({ severity }) => severity === 'loss').map(({ code }) => code),
      ),
    ].sort();
    if (fixture.losses) assert.deepEqual(losses, fixture.losses.toSorted());
    for (const code of fixture.errors ?? [])
      assert.ok(
        result.diagnostics.some((d) => d.severity === 'error' && d.code === code),
        code,
      );
    if (result.status === 'rejected') {
      assert.equal('value' in result, false);
      return;
    }
    const graph = result.value.graph;
    if (fixture.nodes)
      assert.deepEqual(
        graph.nodes.map(({ id, label }) => [id, label]),
        fixture.nodes,
      );
    if (fixture.edges)
      assert.deepEqual(
        graph.edges.map((edge) => [edge.id, edge.source.node, edge.target.node, edge.label ?? '']),
        fixture.edges,
      );
    const original = createEditor(graph);
    const edited = updateEditor(original, {
      type: 'NodeLabelChanged',
      id: graph.nodes[0].id,
      label: 'Edited "quote" & #quot; / 支付',
    });
    const exported = await exportFlowchart(edited.graph, {
      lossPolicy: 'report',
      direction: result.value.direction,
    });
    assert.equal(exported.status, 'converted');
    const restored = await importFlowchart(exported.value.source, {
      identity: exported.value.identity,
      lossPolicy: 'report',
    });
    assert.equal(restored.status, 'converted');
    assert.deepEqual(facts(restored.value.graph), facts(edited.graph));
    assert.deepEqual(facts(updateEditor(edited, { type: 'UndoPressed' }).graph), facts(graph));
  });

test('strict loss policy returns diagnostics and no partial graph', async () => {
  for (const fixture of corpus.filter((item) => item.losses?.length)) {
    const strict = await importFlowchart(fixture.source);
    assert.equal(strict.status, 'rejected');
    assert.equal('value' in strict, false);
    assert.ok(strict.diagnostics.some((item) => item.severity === 'loss'));
  }
});

test('arbitrary Flow IDs and every port identity use an explicit map; other fields are reported as losses', async () => {
  const graph = {
    nodes: [
      {
        id: 'end',
        label: 'Café & "Tea"',
        position: { x: 25, y: 90 },
        size: { width: 250, height: 180 },
        architecture: { family: 'c4', role: 'container', technology: 'PostgreSQL' },
        data: { owner: 'sales' },
        ports: [
          { id: 'send / now', kind: 'output', side: 'top', anchor: { x: 0.3, y: 0.4 } },
          { id: 'unused', kind: 'input', side: 'left', offset: 0.7 },
        ],
      },
      {
        id: '支付 🔁',
        label: 'Receiver',
        position: { x: 500, y: 70 },
        size: { width: 250, height: 180 },
        ports: [{ id: 'receive', kind: 'input', side: 'left', offset: 0.5 }],
      },
    ],
    edges: [
      {
        id: 'order / 1',
        source: { node: 'end', port: 'send / now' },
        target: { node: '支付 🔁', port: 'receive' },
        label: 'Sends "quoted" values',
        data: { host: true },
        pathStyle: 'smooth',
      },
    ],
  };
  const snapshot = JSON.stringify(graph);
  const exported = await exportFlowchart(graph, { lossPolicy: 'report' });
  assert.equal(exported.status, 'converted');
  assert.deepEqual(
    [
      ...new Set(exported.diagnostics.filter((d) => d.severity === 'loss').map((d) => d.code)),
    ].sort(),
    [
      'edge-fields-omitted',
      'identity-map-required',
      'layout-omitted',
      'node-fields-omitted',
      'port-details-omitted',
    ],
  );
  const imported = await importFlowchart(exported.value.source, {
    identity: exported.value.identity,
  });
  assert.equal(imported.status, 'converted');
  assert.deepEqual(facts(imported.value.graph), facts(graph));
  assert.equal(imported.value.graph.nodes[0].data, undefined);
  assert.equal(imported.value.graph.nodes[0].architecture, undefined);
  assert.equal(JSON.stringify(graph), snapshot);
  assert.equal((await exportFlowchart(graph)).status, 'rejected');
  const sourceOnly = await importFlowchart(exported.value.source);
  assert.equal(sourceOnly.status, 'converted');
  assert.notDeepEqual(facts(sourceOnly.value.graph), facts(graph));
});

test('identity maps reject duplicate, stale or wrong-endpoint entries rather than assigning incorrect identities', async () => {
  const parsed = await importFlowchart(corpus[3].source);
  assert.equal(parsed.status, 'converted');
  const exported = await exportFlowchart(parsed.value.graph, { lossPolicy: 'report' });
  assert.equal(exported.status, 'converted');
  const map = exported.value.identity;
  for (const identity of [
    null,
    { ...map, nodes: [...map.nodes, map.nodes[0]] },
    { ...map, edges: [] },
    {
      ...map,
      edges: map.edges.map((edge, i) => (i === 0 ? { ...edge, sourceNode: 'wrong' } : edge)),
    },
    { ...map, nodes: map.nodes.map((node) => ({ ...node, flowId: 'duplicate' })) },
  ]) {
    const result = await importFlowchart(exported.value.source, { identity });
    assert.equal(result.status, 'rejected');
    assert.ok(result.diagnostics.some((d) => d.code === 'invalid-identity-map'));
    assert.equal('value' in result, false);
  }
});

test('conservative feature boundary handles inline styles, quoted keywords, metadata and reverse arrows', async () => {
  const style = await importFlowchart('flowchart LR\nA --> B; style B fill:red', {
    lossPolicy: 'report',
  });
  assert.equal(style.status, 'converted');
  assert.ok(
    style.diagnostics.some((d) => d.code === 'presentation-omitted' && d.location?.line === 2),
  );
  assert.equal(
    (await importFlowchart('flowchart LR\nA["style; click; @{text}"] --> B')).status,
    'converted',
  );
  for (const source of [
    'flowchart LR\nA <--> B',
    'flowchart LR\nA --- B',
    'flowchart LR\nA["<b>HTML</b>"] --> B',
    'flowchart LR\nA@{shape:rect} --> B',
    'flowchart LR\nA["#unknown;"] --> B',
  ])
    assert.equal((await importFlowchart(source, { lossPolicy: 'report' })).status, 'rejected');
  assert.equal((await importFlowchart('A'.repeat(32769))).status, 'rejected');
});

test('pinned upstream behavior explains the restricted adapter and exporter', async () => {
  await assert.rejects(officialParse('flowchart', 'flowchart LR\nA --> B'), /Unknown diagram type/);
  const ast = parseFlowchart('flowchart LR\nA e1@--> B\nstyle B fill:red');
  assert.equal(ast.links[0].id, 'e1@');
  assert.equal(ast.nodes.get('B').props, undefined);
  assert.equal(renderFlowchart(ast).includes('e1'), false);
});

test('the read-only CLI and SDK agree for every fixture and cannot execute diagram callbacks', async () => {
  globalThis.spikeCallback = () => {
    throw new Error('Diagram callback executed');
  };
  const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
  for (const fixture of corpus) {
    const expected = await importFlowchart(fixture.source, { lossPolicy: 'report' });
    const run = spawnSync(process.execPath, [cli], {
      input: JSON.stringify({ operation: 'import', source: fixture.source, lossPolicy: 'report' }),
      encoding: 'utf8',
    });
    assert.equal(run.status, expected.status === 'converted' ? 0 : 1, run.stderr);
    assert.deepEqual(JSON.parse(run.stdout), expected);
  }
  delete globalThis.spikeCallback;
});

test('export driver matches SDK and malformed requests return structured errors', async () => {
  const imported = await importFlowchart(corpus[0].source);
  const graph = imported.value.graph;
  const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
  const request = { operation: 'export', document: serializeGraph(graph), lossPolicy: 'report' };
  const run = spawnSync(process.execPath, [cli], {
    input: JSON.stringify(request),
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), await exportFlowchart(graph, { lossPolicy: 'report' }));
  for (const input of [
    '{',
    'null',
    '{"operation":"import","source":7}',
    '{"operation":"export","document":"invalid"}',
  ]) {
    const invalid = spawnSync(process.execPath, [cli], { input, encoding: 'utf8' });
    assert.equal(invalid.status, 1);
    assert.equal(JSON.parse(invalid.stdout).diagnostics[0].code, 'invalid-request');
    assert.equal('value' in JSON.parse(invalid.stdout), false);
  }
  const invalidLabel = {
    ...graph,
    edges: graph.edges.map((edge) => ({ ...edge, label: 'fa:icon' })),
  };
  const rejected = await exportFlowchart(invalidLabel, { lossPolicy: 'report' });
  assert.equal(rejected.status, 'rejected');
  assert.ok(rejected.diagnostics.some(({ code }) => code === 'unsupported-label-encoding'));
});

test('supported authored outlines and directions map explicitly', async () => {
  const imported = await importFlowchart(
    corpus.find(({ id }) => id === 'supported-outlines').source,
  );
  assert.deepEqual(
    imported.value.graph.nodes.map(({ appearance }) => appearance.shape),
    ['rectangle', 'rounded-rectangle', 'cylinder'],
  );
  assert.equal(imported.value.direction, 'TB');
  for (const direction of ['LR', 'RL', 'TB', 'BT']) {
    const converted = await importFlowchart(`flowchart ${direction}\nA --> B`);
    assert.equal(converted.value.direction, direction);
    const exported = await exportFlowchart(converted.value.graph, {
      direction,
      lossPolicy: 'report',
    });
    assert.equal(exported.value.direction, direction);
  }
});

test('empty graphs produce a parseable declaration without a fabricated node', async () => {
  const result = await exportFlowchart({ nodes: [], edges: [] });
  assert.equal(result.status, 'converted');
  const restored = await importFlowchart(result.value.source, { identity: result.value.identity });
  assert.equal(restored.status, 'converted');
  assert.deepEqual(restored.value.graph, { nodes: [], edges: [] });
});
