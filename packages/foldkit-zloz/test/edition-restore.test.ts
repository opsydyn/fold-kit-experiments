/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Authored node appearance is a geometric domain contract. */
import { expect, test } from 'bun:test';

import {
  captureEdition,
  createEditor,
  updateEditor,
  resolveEditionRestore,
  restoreEdition,
  mergeEditions,
  type ZlozGraph,
  type ZlozEditionRestorePolicy,
} from '../src/index';
const graph: ZlozGraph = {
  nodes: [
    {
      id: 'a',
      label: 'Order',
      position: { x: 0, y: 0 },
      size: { width: 200, height: 120 },
      ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
    },
    {
      id: 'b',
      label: 'Delivery',
      position: { x: 400, y: 0 },
      size: { width: 200, height: 120 },
      ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
    },
  ],
  edges: [{ id: 'wire', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } }],
};
const edition = (id: string, model: ZlozGraph = graph) =>
  captureEdition({
    id,
    name: id,
    snapshot: { graph: model, viewport: { x: 900, y: 900, zoom: 2 } },
  });

test('merge is additive, idempotent and atomic on identity conflicts', () => {
  const first = edition('first'),
    second = edition('second');
  const current = [first];
  expect(mergeEditions(current, [first])).toEqual({ type: 'unchanged', editions: current });
  const merged = mergeEditions(current, [second]);
  expect(merged.type).toBe('merged');
  if (merged.type !== 'blocked')
    expect(merged.editions.map((item) => item.id)).toEqual(['first', 'second']);
  const conflict = { ...first, name: 'Different meaning' };
  expect(mergeEditions(current, [second, conflict]).type).toBe('blocked');
  expect(current).toEqual([first]);
  expect(mergeEditions(current, [second, second]).type).toBe('blocked');
});

test('restore commits one graph transaction, preserves camera and supports Undo/Redo', () => {
  const working = createEditor({ nodes: [], edges: [] }, { viewport: { x: 12, y: 24, zoom: 0.8 } });
  const restored = restoreEdition(working, edition('target'), {
    expectedRevision: working.revision,
  });
  expect(restored.type).toBe('restored');
  expect(restored.editor.graph).toEqual(graph);
  expect(restored.editor.viewport).toBe(working.viewport);
  expect(restored.editor.past).toEqual([working.graph]);
  expect(restored.editor.revision).toBe(working.revision + 1);
  const undone = updateEditor(restored.editor, { type: 'UndoPressed' });
  expect(undone.graph).toEqual(working.graph);
  expect(updateEditor(undone, { type: 'RedoPressed' }).graph).toEqual(graph);
  expect(working.graph.nodes).toHaveLength(0);
});

test('stale, busy, read-only, unavailable Undo and blank policy vetoes do not mutate the editor', () => {
  const working = createEditor({ nodes: [], edges: [] });
  for (const [state, expectedRevision, policy] of [
    [working, 99, {}],
    [{ ...working, readOnly: true }, 0, {}],
    [{ ...working, historyLimit: 0 }, 0, {}],
    [updateEditor(working, { type: 'PanStarted', pointer: 1, point: { x: 0, y: 0 } }), 0, {}],
    [working, 0, { canRestoreEdition: () => '' }],
  ] as const) {
    const result = restoreEdition(state, edition('target'), { expectedRevision, policy });
    expect(result.type).toBe('blocked');
    expect(result.editor).toBe(state);
  }
  const same = createEditor(graph);
  const unchanged = restoreEdition(same, edition('same'), { expectedRevision: 0 });
  expect(unchanged.type).toBe('unchanged');
  expect(unchanged.editor).toBe(same);
});

test('restore rechecks current policy after a ready preview and honors granular editing protections', () => {
  const working = createEditor(graph);
  const modified: ZlozGraph = {
    nodes: graph.nodes.map((node) =>
      node.id === 'a'
        ? {
            ...node,
            position: { x: 50, y: 0 },
            size: { width: 250, height: 120 },
            architecture: { family: 'ddd', role: 'aggregate-root' },
            ports: node.ports.map((port) => ({
              id: port.id,
              kind: port.kind,
              side: port.side,
              label: 'New label',
              offset: 0.8,
            })),
          }
        : node,
    ),
    edges: graph.edges,
  };
  const target = edition('modified', modified);
  expect(resolveEditionRestore(working, target, { expectedRevision: 0 }).type).toBe('ready');
  const policies: readonly ZlozEditionRestorePolicy[] = [
    { canRestoreEdition: () => 'Approval revoked' },
    { canMoveNode: () => 'Position locked' },
    { canResizeNode: () => 'Size locked' },
    { canChangeNodeArchitecture: () => 'Meaning locked' },
    { canEditPort: () => 'Socket locked' },
  ];
  for (const policy of policies) {
    const result = restoreEdition(working, target, { expectedRevision: 0, policy });
    expect(result.type).toBe('blocked');
    expect(result.editor).toBe(working);
  }
  const deleting = restoreEdition(working, edition('empty', { nodes: [], edges: [] }), {
    expectedRevision: 0,
    policy: { canDelete: () => 'Required model' },
  });
  expect(deleting.type).toBe('blocked');
  const creating = restoreEdition(
    createEditor({ nodes: graph.nodes, edges: [] }),
    edition('connected'),
    { expectedRevision: 0, policy: { canConnect: () => 'No new dependency' } },
  );
  expect(creating.type).toBe('blocked');
});

test('appearance, deletion, port and reconnection protections cover the complete replacement without partial commits', () => {
  const working = createEditor(graph);
  const portTarget = edition('ports', {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.id === 'a'
        ? {
            ...node,
            ports: [
              { id: 'out', kind: 'output', side: 'top', offset: 0.9, label: 'Changed' },
              { id: 'new', kind: 'output', side: 'right', offset: 0.5 },
            ],
          }
        : node,
    ),
  });
  for (const operation of ['add', 'label', 'position'] as const) {
    const result = restoreEdition(working, portTarget, {
      expectedRevision: 0,
      policy: {
        canEditPort: (candidate) =>
          candidate.operation === operation ? `${operation} denied` : null,
      },
    });
    expect(result.type).toBe('blocked');
    expect(result.editor).toBe(working);
  }
  const appearanceTarget = edition('appearance', {
    ...graph,
    nodes: graph.nodes.map((node) => ({ ...node, appearance: { shape: 'rounded-rectangle' } })),
  });
  expect(
    restoreEdition(working, appearanceTarget, {
      expectedRevision: 0,
      policy: { canChangeNodeAppearance: () => 'Appearance protected' },
    }).type,
  ).toBe('blocked');
  const disconnected = edition('disconnected', {
    nodes: graph.nodes.map((node) => ({ ...node, ports: [] })),
    edges: [],
  });
  expect(
    restoreEdition(working, disconnected, {
      expectedRevision: 0,
      policy: { canEditPort: () => 'Cannot remove sockets' },
    }).type,
  ).toBe('blocked');
  expect(
    restoreEdition(working, disconnected, {
      expectedRevision: 0,
      policy: { canDelete: () => 'Cannot remove dependencies' },
    }).type,
  ).toBe('blocked');
  const kindChange = edition('kind-change', {
    nodes: graph.nodes.map((node) =>
      node.id === 'a'
        ? { ...node, ports: node.ports.map((port) => ({ ...port, kind: 'input' as const })) }
        : node,
    ),
    edges: [],
  });
  expect(
    restoreEdition(working, kindChange, {
      expectedRevision: 0,
      policy: {
        canEditPort: (candidate) =>
          candidate.operation === 'add' ? 'Cannot replace port kind' : null,
      },
    }).type,
  ).toBe('blocked');
  const emptyEdges = createEditor({ nodes: graph.nodes, edges: [] });
  expect(
    restoreEdition(emptyEdges, edition('wired'), {
      expectedRevision: 0,
      policy: { canConnectPort: (endpoint) => (endpoint.node === 'b' ? 'Target protected' : null) },
    }).type,
  ).toBe('blocked');
  const extra = { ...graph.nodes[1]!, id: 'c', label: 'Other target' };
  const before = createEditor({ ...graph, nodes: [...graph.nodes, extra] });
  const rewired = edition('rewired', {
    nodes: [...graph.nodes, extra],
    edges: graph.edges.map((edge) => ({ ...edge, target: { node: 'c', port: 'in' } })),
  });
  expect(
    restoreEdition(before, rewired, {
      expectedRevision: 0,
      policy: { canReconnect: () => 'End protected' },
    }).type,
  ).toBe('blocked');
  // Reconnecting only the target preserves the existing source, matching normal endpoint policy semantics.
  expect(
    restoreEdition(before, rewired, {
      expectedRevision: 0,
      policy: {
        canConnectPort: (endpoint) => (endpoint.node === 'a' ? 'No new source connections' : null),
      },
    }).type,
  ).toBe('restored');
});

test('a changed working graph invalidates preview; restored documents remain editable without changing the edition', () => {
  const working = createEditor({ nodes: [], edges: [] });
  const target = edition('target');
  const restored = restoreEdition(working, target, { expectedRevision: 0 });
  const edited = updateEditor(restored.editor, {
    type: 'NodeLabelChanged',
    id: 'a',
    label: 'Edited after restore',
  });
  expect(edited.graph.nodes[0]?.label).toBe('Edited after restore');
  expect(target.snapshot.graph.nodes[0]?.label).toBe('Order');
  expect(edited.past).toHaveLength(2);
  expect(restoreEdition(edited, target, { expectedRevision: restored.editor.revision }).type).toBe(
    'blocked',
  );
});
