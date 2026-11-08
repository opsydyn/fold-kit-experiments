/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Literal graph outline assertions. */
import { expect, test } from 'bun:test';

import type { ZlozGraph } from '@opsydyn/foldkit-zloz';

import { exportMermaid, mermaidProtocol, mermaidSourceLimit } from '../src/index';

const graph: ZlozGraph = {
  nodes: [
    {
      id: 'end',
      label: 'Café "tea" & #quot; <支付>\nnext',
      position: { x: 12, y: 35 },
      size: { width: 180, height: 90 },
      ports: [
        { id: 'send / now', kind: 'output', side: 'right', offset: 0.5 },
        { id: 'unused', kind: 'input', side: 'left', offset: 0.3 },
      ],
    },
    {
      id: '支付',
      label: 'Store',
      appearance: { shape: 'cylinder' },
      position: { x: 300, y: 35 },
      size: { width: 180, height: 90 },
      ports: [{ id: 'receive', kind: 'input', side: 'left', offset: 0.5 }],
    },
  ],
  edges: [
    {
      id: 'one',
      source: { node: 'end', port: 'send / now' },
      target: { node: '支付', port: 'receive' },
      label: 'first | "yes"',
    },
    {
      id: 'two',
      source: { node: 'end', port: 'send / now' },
      target: { node: '支付', port: 'receive' },
    },
  ],
};

test('explicit loss consent emits exact literal syntax, named parallel edges and detached identity metadata', () => {
  const snapshot = JSON.stringify(graph);
  const result = exportMermaid(graph, { lossPolicy: 'report' });
  expect(result.status).toBe('converted');
  if (result.status !== 'converted') throw new Error('Expected export');
  expect(result.protocol).toBe(mermaidProtocol);
  expect(result.value.source).toBe(
    'flowchart LR\n  n_65_6e_64["Café #34;tea#34; #38; #35;quot; #60;支付#62;#10;next"]\n  n_652f_4ed8[("Store")]\n  n_65_6e_64 e_6f_6e_65@-->|"first #124; #34;yes#34;"| n_652f_4ed8\n  n_65_6e_64 e_74_77_6f@--> n_652f_4ed8\n',
  );
  expect(result.value.identity).toEqual({
    version: 1,
    nodes: [
      {
        mermaidId: 'n_65_6e_64',
        flowId: 'end',
        ports: [
          { id: 'send / now', kind: 'output' },
          { id: 'unused', kind: 'input' },
        ],
      },
      { mermaidId: 'n_652f_4ed8', flowId: '支付', ports: [{ id: 'receive', kind: 'input' }] },
    ],
    edges: [
      {
        mermaidId: 'e_6f_6e_65',
        flowId: 'one',
        sourceNode: 'n_65_6e_64',
        sourcePort: 'send / now',
        targetNode: 'n_652f_4ed8',
        targetPort: 'receive',
      },
      {
        mermaidId: 'e_74_77_6f',
        flowId: 'two',
        sourceNode: 'n_65_6e_64',
        sourcePort: 'send / now',
        targetNode: 'n_652f_4ed8',
        targetPort: 'receive',
      },
    ],
  });
  expect(result.value.diagnostics).toEqual(result.diagnostics);
  expect(JSON.stringify(graph)).toBe(snapshot);
  expect(exportMermaid(graph, { lossPolicy: 'report' })).toEqual(result);
});

test('strict policy returns typed losses with no partial download; architecture and authored fields never disappear silently', () => {
  const authored: ZlozGraph = {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      architecture: { family: 'c4', role: 'software-system' },
      data: { owner: 'sales' },
    })),
    edges: graph.edges.map((edge) => ({ ...edge, pathStyle: 'smooth', data: { policy: true } })),
  };
  const strict = exportMermaid(authored);
  expect(strict.status).toBe('rejected');
  expect('value' in strict).toBe(false);
  expect([...new Set(strict.diagnostics.map((item) => item.code))].sort()).toEqual([
    'edge-fields-omitted',
    'identity-map-required',
    'layout-omitted',
    'node-fields-omitted',
    'port-details-omitted',
  ]);
  expect(strict.diagnostics.every((item) => item.severity === 'loss')).toBe(true);
  expect(strict.diagnostics.find((item) => item.code === 'node-fields-omitted')?.subject).toBe(
    'end',
  );
  expect(strict.diagnostics.find((item) => item.code === 'node-fields-omitted')?.message).toContain(
    'architecture',
  );
});

test('empty groups and malformed graphs reject even with loss consent', () => {
  const grouped: ZlozGraph = {
    nodes: [
      {
        id: 'group',
        kind: 'group',
        label: 'Boundary',
        ports: [],
        position: { x: 0, y: 0 },
        size: { width: 400, height: 300 },
      },
    ],
    edges: [],
  };
  const result = exportMermaid(grouped, { lossPolicy: 'report' });
  expect(result.status).toBe('rejected');
  expect(result.diagnostics.some((item) => item.code === 'unsupported-subgraph')).toBe(true);
  const invalid = exportMermaid(
    { ...graph, edges: [{ ...graph.edges[0]!, target: { node: 'missing', port: 'in' } }] },
    { lossPolicy: 'report' },
  );
  expect(invalid.status).toBe('rejected');
  expect(invalid.diagnostics[0]?.code).toBe('invalid-graph');
  expect('value' in invalid).toBe(false);
});

test('every direction, all built-in outlines and empty graphs have explicit output', () => {
  expect(exportMermaid({ nodes: [], edges: [] })).toMatchObject({
    status: 'converted',
    value: { source: 'flowchart LR\n', identity: { version: 1, nodes: [], edges: [] } },
  });
  for (const direction of ['LR', 'RL', 'TB', 'BT'] as const) {
    const result = exportMermaid(
      {
        ...graph,
        nodes: graph.nodes.map((node) => ({ ...node, appearance: { shape: 'rounded-rectangle' } })),
      },
      { lossPolicy: 'report', direction },
    );
    if (result.status !== 'converted') throw new Error('Expected export');
    expect(result.value.source.startsWith(`flowchart ${direction}\n`)).toBe(true);
    expect(result.value.source).toContain('n_652f_4ed8("Store")');
  }
});

test('literal label rejection and source bounds apply to nodes and edges without partial values', () => {
  for (const label of ['', 'fa:icon', '\u0000', '\u0001', '\ud800']) {
    for (const input of [
      { ...graph, nodes: graph.nodes.map((node) => ({ ...node, label })) },
      { ...graph, edges: graph.edges.map((edge) => ({ ...edge, label })) },
    ]) {
      const result = exportMermaid(input, { lossPolicy: 'report' });
      expect(result.status).toBe('rejected');
      expect(result.diagnostics.some((item) => item.code === 'unsupported-label-encoding')).toBe(
        true,
      );
      expect('value' in result).toBe(false);
    }
  }
  const large = exportMermaid(
    {
      ...graph,
      nodes: graph.nodes.map((node) => ({ ...node, label: 'x'.repeat(mermaidSourceLimit) })),
    },
    { lossPolicy: 'report' },
  );
  expect(large.status).toBe('rejected');
  expect(large.diagnostics.some((item) => item.code === 'source-limit')).toBe(true);
});

test('the documented source limit is inclusive and measured in UTF-16 code units', () => {
  const overhead = 'flowchart LR\n  n_61[""]\n'.length;
  const node = {
    id: 'a',
    label: 'x'.repeat(mermaidSourceLimit - overhead),
    position: { x: 0, y: 0 },
    size: { width: 100, height: 80 },
    ports: [],
  };
  const accepted = exportMermaid({ nodes: [node], edges: [] }, { lossPolicy: 'report' });
  expect(accepted.status).toBe('converted');
  if (accepted.status !== 'converted') throw new Error('Expected boundary export');
  expect(accepted.value.source.length).toBe(mermaidSourceLimit);
  const rejected = exportMermaid(
    { nodes: [{ ...node, label: node.label + '🔁' }], edges: [] },
    { lossPolicy: 'report' },
  );
  expect(rejected.status).toBe('rejected');
  expect(rejected.diagnostics.some((item) => item.code === 'source-limit')).toBe(true);
});
