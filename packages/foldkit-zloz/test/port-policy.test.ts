import { expect, test } from 'bun:test';

import {
  createEditor,
  updateEditor,
  resolvePortRemoval,
  portEditReason,
  type EditorEvent,
  type EditorPolicy,
  type ZlozGraph,
  type PortEditCandidate,
} from '../src/index';

const node = {
  id: 'a',
  label: 'A',
  position: { x: 0, y: 0 },
  size: { width: 100, height: 80 },
  ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
} as const;
const graph: ZlozGraph = {
  nodes: [
    node,
    {
      id: 'b',
      label: 'B',
      position: { x: 200, y: 0 },
      size: { width: 100, height: 80 },
      ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
    },
  ],
  edges: [{ id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } }],
};
const endpoint = { node: 'a', port: 'out' };
const events: readonly [PortEditCandidate['operation'], EditorEvent][] = [
  [
    'add',
    {
      type: 'PortAdded',
      nodeId: 'a',
      port: { id: 'extra', kind: 'input', side: 'left', offset: 0.5 },
    },
  ],
  ['label', { type: 'PortLabelChanged', endpoint, label: 'Ready' }],
  ['remove', { type: 'PortRemoved', endpoint }],
  [
    'position',
    {
      type: 'PortPositionsChanged',
      positions: [{ endpoint, position: { side: 'top', offset: 0.2 } }],
    },
  ],
];

test('every direct port edit checks the current host policy before publishing', () => {
  const state = createEditor(graph);
  for (const [operation, event] of events) {
    const seen: PortEditCandidate[] = [];
    const policy: EditorPolicy = {
      canEditPort: (candidate, currentGraph) => {
        expect(currentGraph).toBe(state.graph);
        seen.push(candidate);
        return '  Port is managed upstream.  ';
      },
    };
    const blocked = updateEditor(state, event, policy);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.operation).toBe(operation);
    expect(seen[0]?.node).toBe(state.graph.nodes[0]);
    expect(seen[0]?.port.id).toBe(operation === 'add' ? 'extra' : 'out');
    expect(blocked).toEqual({ ...state, notice: 'Port is managed upstream.' });
    expect(blocked.graph).toBe(state.graph);
    expect(blocked.past).toBe(state.past);
    expect(blocked.routes).toBe(state.routes);
    expect(updateEditor(blocked, event, { canEditPort: () => null }).past).toHaveLength(1);
  }
});

test('port removal combines edit protection with the complete attached-edge deletion policy', () => {
  const protectedPort = () => 'Managed port';
  expect(resolvePortRemoval(graph, endpoint, undefined, protectedPort)).toEqual({
    type: 'blocked',
    reason: 'Managed port',
  });
  const unused = { node: 'b', port: 'in' };
  const disconnected = { ...graph, edges: [] };
  expect(resolvePortRemoval(disconnected, unused, undefined, protectedPort)).toEqual({
    type: 'blocked',
    reason: 'Managed port',
  });
  const state = createEditor(graph);
  const blocked = updateEditor(
    state,
    { type: 'PortRemoved', endpoint },
    {
      canEditPort: () => null,
      canDelete: (candidate) =>
        candidate.edges.some(({ id }) => id === 'ab') ? 'Required connection' : null,
    },
  );
  expect(blocked.graph).toBe(state.graph);
  expect(blocked.notice).toBe('Required connection');
  expect(
    resolvePortRemoval(graph, { node: 'missing', port: 'out' }, undefined, protectedPort),
  ).toEqual({ type: 'empty' });
});

test('one protected port vetoes an entire anchor batch and allowed batches undo together', () => {
  const state = createEditor(graph);
  const event: EditorEvent = {
    type: 'PortPositionsChanged',
    positions: [
      { endpoint, position: { side: 'top', offset: 0.2 } },
      { endpoint: { node: 'b', port: 'in' }, position: { side: 'bottom', offset: 0.8 } },
    ],
  };
  const blocked = updateEditor(state, event, {
    canEditPort: ({ node }) => (node.id === 'b' ? 'B input is fixed.' : null),
  });
  expect(blocked).toEqual({ ...state, notice: 'B input is fixed.' });
  expect(blocked.graph).toBe(state.graph);
  const moved = updateEditor(state, event, { canEditPort: () => null });
  expect(moved.graph.nodes.map(({ ports }) => ports[0]?.offset)).toEqual([0.2, 0.8]);
  expect(moved.past).toHaveLength(1);
  expect(updateEditor(moved, { type: 'UndoPressed' }).graph).toEqual(state.graph);
});

test('shared edit reasons normalize blank denials and policies do not lock wiring or unchanged edits', () => {
  const candidate: PortEditCandidate = { node, port: node.ports[0], operation: 'label' };
  expect(portEditReason(candidate, graph)).toBeNull();
  expect(portEditReason(candidate, graph, () => '')).toBe('This port edit is protected.');
  const state = createEditor(graph);
  const noUnchangedCheck: EditorPolicy = {
    canEditPort: () => {
      throw new Error('Unexpected edit check');
    },
  };
  expect(
    updateEditor(state, { type: 'PortLabelChanged', endpoint, label: undefined }, noUnchangedCheck),
  ).toBe(state);
  expect(
    updateEditor(
      state,
      {
        type: 'PortPositionsChanged',
        positions: [{ endpoint, position: { side: 'right', offset: 0.5 } }],
      },
      noUnchangedCheck,
    ),
  ).toBe(state);
  const connected = updateEditor(
    state,
    { type: 'PortActivated', endpoint },
    { canEditPort: () => 'Managed port' },
  );
  expect(connected.connection).toEqual(endpoint);
});
