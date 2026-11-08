/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Exercises authored group outline loss. */
import { expect, test } from 'bun:test';

import type { FlowGraph, FlowNode } from '@opsydyn/foldkit-flow';

import { exportMermaid } from '../src/index';

const node = (id: string, parentId?: string): FlowNode => {
  const base = {
    id,
    label: id,
    position: { x: 0, y: 0 },
    size: { width: 100, height: 80 },
    ports: [
      { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
      { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
    ],
  } satisfies FlowNode;
  return parentId === undefined ? base : { ...base, parentId };
};
const group = (id: string, parentId?: string): FlowNode => ({
  ...node(id, parentId),
  kind: 'group',
  ports: [],
});
const graph: FlowGraph = {
  nodes: [node('a', 'i'), group('o'), node('z'), group('i', 'o'), node('b', 'o')],
  edges: [
    { id: 'cross', source: { node: 'a', port: 'out' }, target: { node: 'z', port: 'in' } },
    { id: 'inside', source: { node: 'b', port: 'out' }, target: { node: 'a', port: 'in' } },
    { id: 'parallel', source: { node: 'a', port: 'out' }, target: { node: 'z', port: 'in' } },
    { id: 'loop', source: { node: 'a', port: 'out' }, target: { node: 'a', port: 'in' } },
  ],
};

test('nested subgraphs preserve hierarchy, sibling order and original endpoints despite child-first input', () => {
  const snapshot = JSON.stringify(graph);
  const result = exportMermaid(graph, { lossPolicy: 'report' });
  expect(result.status).toBe('converted');
  if (result.status !== 'converted') throw new Error('Expected nested export');
  expect(result.value.source).toBe(
    'flowchart LR\n  subgraph n_6f["o"]\n    subgraph n_69["i"]\n      n_61["a"]\n    end\n    n_62["b"]\n  end\n  n_7a["z"]\n  n_61 e_63_72_6f_73_73@--> n_7a\n  n_62 e_69_6e_73_69_64_65@--> n_61\n  n_61 e_70_61_72_61_6c_6c_65_6c@--> n_7a\n  n_61 e_6c_6f_6f_70@--> n_61\n',
  );
  expect(result.value.identity.nodes.find((entry) => entry.flowId === 'i')).toEqual({
    mermaidId: 'n_69',
    flowId: 'i',
    ports: [],
    kind: 'group',
    parentId: 'o',
  });
  expect(result.value.identity.nodes.find((entry) => entry.flowId === 'a')?.parentId).toBe('i');
  expect(result.value.identity.edges[0]).toEqual({
    mermaidId: 'e_63_72_6f_73_73',
    flowId: 'cross',
    sourceNode: 'n_61',
    sourcePort: 'out',
    targetNode: 'n_7a',
    targetPort: 'in',
  });
  expect(
    result.diagnostics.some(
      (item) =>
        item.code === 'node-fields-omitted' &&
        (item.message.includes('parentId') || item.message.includes('kind')),
    ),
  ).toBe(false);
  expect(exportMermaid(graph).status).toBe('rejected');
  expect(JSON.stringify(graph)).toBe(snapshot);
});

test('group labels are encoded, outline loss is visible and empty boundaries never become fake nodes', () => {
  const result = exportMermaid(
    {
      nodes: [
        { ...group('g'), label: 'Group "end" & 支付', appearance: { shape: 'rectangle' } },
        node('a', 'g'),
      ],
      edges: [],
    },
    { lossPolicy: 'report' },
  );
  expect(result.status).toBe('converted');
  if (result.status !== 'converted') throw new Error('Expected nested export');
  expect(result.value.source).toContain('subgraph n_67["Group #34;end#34; #38; 支付"]');
  expect(
    result.diagnostics.some(
      (item) => item.code === 'group-presentation-omitted' && item.subject === 'g',
    ),
  ).toBe(true);
  for (const nodes of [[group('g')], [group('o'), group('i', 'o')]]) {
    const empty = exportMermaid({ nodes, edges: [] }, { lossPolicy: 'report' });
    expect(empty.status).toBe('rejected');
    expect(empty.diagnostics.some((item) => item.code === 'unsupported-subgraph')).toBe(true);
    expect('value' in empty).toBe(false);
  }
});

test('invalid parents, membership cycles and group endpoints reject through public graph validation', () => {
  for (const nodes of [[node('a', 'missing')], [group('o', 'i'), group('i', 'o')]]) {
    expect(exportMermaid({ nodes, edges: [] }, { lossPolicy: 'report' })).toMatchObject({
      status: 'rejected',
      diagnostics: [{ code: 'invalid-graph' }],
    });
  }
  const result = exportMermaid(
    {
      nodes: [group('g'), node('a', 'g')],
      edges: [{ id: 'bad', source: { node: 'g', port: 'out' }, target: { node: 'a', port: 'in' } }],
    },
    { lossPolicy: 'report' },
  );
  expect(result.status).toBe('rejected');
  expect(result.diagnostics[0]?.code).toBe('invalid-graph');
});

test('deep valid hierarchy returns a bounded rejection rather than overflowing traversal', () => {
  const nodes = Array.from({ length: 1500 }, (_, index) =>
    group(`g${index}`, index === 0 ? undefined : `g${index - 1}`),
  );
  const result = exportMermaid(
    { nodes: [...nodes, node('leaf', 'g1499')], edges: [] },
    { lossPolicy: 'report' },
  );
  expect(result.status).toBe('rejected');
  expect(result.diagnostics.some((item) => item.code === 'source-limit')).toBe(true);
  expect('value' in result).toBe(false);
});
