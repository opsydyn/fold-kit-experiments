import { expect, test } from 'bun:test';

import {
  captureEdition,
  appendEdition,
  serializeEditions,
  parseEditions,
  createHistoryReview,
  updateHistoryReview,
  compareEditions,
  createEditor,
  updateEditor,
  type EditorEvent,
  type ZlozGraph,
} from '../src/index';

const graph: ZlozGraph = {
  nodes: [
    {
      id: 'a',
      label: 'Order',
      position: { x: 10, y: 20 },
      size: { width: 180, height: 100 },
      ports: [],
      data: { nested: ['original'] },
    },
  ],
  edges: [],
};
const edition = () =>
  captureEdition({
    id: 'first',
    name: 'First model',
    snapshot: { graph, viewport: { x: 0, y: 0, zoom: 1 } },
  });
test('editions detach and deeply freeze snapshots; archives are versioned and validate duplicate IDs and cameras', () => {
  const item = edition();
  expect(item.snapshot.graph).not.toBe(graph);
  expect(item.snapshot.graph.nodes[0]?.data).not.toBe(graph.nodes[0]?.data);
  expect(Object.isFrozen(graph.nodes[0]?.data)).toBe(false);
  expect(Object.isFrozen(item.snapshot.graph.nodes[0]?.data)).toBe(true);
  expect(Object.isFrozen(item.snapshot.graph.nodes[0]?.position)).toBe(true);
  expect(parseEditions(serializeEditions([item]))).toEqual([item]);
  expect(() => appendEdition([item], item)).toThrow('Duplicate edition');
  expect(() => captureEdition({ id: '', name: 'Name', snapshot: { graph } })).toThrow();
  expect(() =>
    parseEditions('{"format":"foldkit-zloz-editions","version":2,"editions":[]}'),
  ).toThrow();
  expect(() =>
    parseEditions(
      JSON.stringify({
        format: 'foldkit-zloz-editions',
        version: 1,
        editions: [{ id: 'x', name: 'X', snapshot: { graph, viewport: { x: 0, y: 0, zoom: 0 } } }],
      }),
    ),
  ).toThrow();
  expect(() =>
    parseEditions(
      JSON.stringify({ format: 'foldkit-zloz-editions', version: 1, editions: [item, item] }),
    ),
  ).toThrow();
});
test('rewind navigates separately and rejects editing, measurement and Undo without touching the working editor', () => {
  const present = updateEditor(createEditor(graph), {
    type: 'NodeLabelChanged',
    id: 'a',
    label: 'Working order',
  });
  const review = createHistoryReview(edition(), present);
  expect(review.editor.readOnly).toBe(true);
  expect(review.editor.graph.nodes[0]?.label).toBe('Order');
  expect(
    updateHistoryReview(
      review,
      { type: 'NodeSelected', id: 'a', additive: false },
      { canSelectNode: () => 'Not selectable' },
    ).editor.selectedNodes,
  ).toEqual([]);
  expect(
    updateHistoryReview(review, { type: 'NodeSelected', id: 'a', additive: false }).editor
      .selectedNodes,
  ).toEqual(['a']);
  const forbidden: EditorEvent[] = [
    { type: 'NodeLabelChanged', id: 'a', label: 'Attack' },
    { type: 'DeletePressed' },
    { type: 'UndoPressed' },
    { type: 'RedoPressed' },
    { type: 'NodeMeasured', id: 'a', size: { width: 999, height: 999 } },
    { type: 'NodeDragStarted', id: 'a', pointer: 1, point: { x: 0, y: 0 } },
    { type: 'NodeArchitectureChanged', id: 'a', architecture: { family: 'ddd', role: 'entity' } },
  ];
  for (const event of forbidden) expect(updateHistoryReview(review, event)).toBe(review);
  const navigated = updateHistoryReview(review, { type: 'ViewportNudged', delta: { x: 50, y: 0 } });
  expect(navigated.editor.viewport.x).toBe(review.editor.viewport.x + 50);
  expect(navigated.editor.graph).toBe(review.editor.graph);
  expect(present.graph.nodes[0]?.label).toBe('Working order');
  expect(present.past).toHaveLength(1);
});
test('comparison separates meaning from layout and ignores JSON object key ordering', () => {
  const before = edition();
  const moved = captureEdition({
    id: 'moved',
    name: 'Moved',
    snapshot: {
      graph: {
        ...graph,
        nodes: graph.nodes.map((node) => ({ ...node, position: { x: 80, y: 20 } })),
      },
    },
  });
  const diff = compareEditions(before, moved);
  expect(
    diff.nodes.map((change) => [
      change.id,
      change.kind,
      change.semanticChanged,
      change.layoutChanged,
    ]),
  ).toEqual([['a', 'changed', false, true]]);
  const renamed = captureEdition({
    id: 'renamed',
    name: 'Renamed',
    snapshot: {
      graph: { ...graph, nodes: graph.nodes.map((node) => ({ ...node, label: 'Purchase' })) },
    },
  });
  expect(
    compareEditions(before, renamed).nodes.map((change) => [
      change.semanticChanged,
      change.layoutChanged,
    ]),
  ).toEqual([[true, false]]);
  const removed = captureEdition({
    id: 'empty',
    name: 'Empty',
    snapshot: { graph: { nodes: [], edges: [] } },
  });
  expect(compareEditions(before, removed).nodes[0]?.kind).toBe('removed');
  expect(compareEditions(removed, before).nodes[0]?.kind).toBe('added');
  const reordered = captureEdition({
    id: 'same',
    name: 'Same',
    snapshot: { graph: { edges: [], nodes: [{ ...graph.nodes[0]!, position: { y: 20, x: 10 } }] } },
  });
  expect(compareEditions(before, reordered).nodes).toEqual([]);
});

test('literal archive retains domain identity and rejects unknown reserved envelope fields', async () => {
  const literal = await Bun.file(new URL('./fixtures/editions-v1.json', import.meta.url)).text();
  const parsed = parseEditions(literal);
  expect(parsed[0]?.snapshot.graph.nodes[0]?.architecture).toEqual({
    family: 'ddd',
    role: 'aggregate-root',
  });
  expect(parsed[0]?.id).toBe('baseline');
  expect(Object.isFrozen(parsed)).toBe(true);
  expect(() =>
    parseEditions(literal.replace(/"version":\s*1/u, '"version":1,"unexpected":true')),
  ).toThrow();
});

test('edge changes distinguish endpoint/label meaning from geometry induced by moved nodes', () => {
  const wired: ZlozGraph = {
    nodes: [
      { ...graph.nodes[0]!, ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }] },
      {
        ...graph.nodes[0]!,
        id: 'b',
        position: { x: 400, y: 20 },
        ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
      },
    ],
    edges: [
      {
        id: 'wire',
        label: 'Publishes',
        source: { node: 'a', port: 'out' },
        target: { node: 'b', port: 'in' },
      },
    ],
  };
  const before = captureEdition({ id: 'before', name: 'Before', snapshot: { graph: wired } });
  const after = captureEdition({
    id: 'after',
    name: 'After',
    snapshot: {
      graph: {
        ...wired,
        nodes: wired.nodes.map((node) =>
          node.id === 'b' ? { ...node, position: { x: 400, y: 150 } } : node,
        ),
      },
    },
  });
  expect(
    compareEditions(before, after).edges.map((change) => [
      change.kind,
      change.semanticChanged,
      change.layoutChanged,
    ]),
  ).toEqual([['changed', false, true]]);
  const rename = captureEdition({
    id: 'rename',
    name: 'Rename',
    snapshot: {
      graph: { ...wired, edges: wired.edges.map((edge) => ({ ...edge, label: 'Subscribes' })) },
    },
  });
  expect(
    compareEditions(before, rename).edges.map((change) => [
      change.semanticChanged,
      change.layoutChanged,
    ]),
  ).toEqual([[true, false]]);
});
