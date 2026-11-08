import { expect, test } from 'bun:test';

import {
  createEditor,
  updateEditor,
  parseGraph,
  serializeGraph,
  type Port,
  type ZlozGraph,
} from '../src/index';

const graph: ZlozGraph = {
  nodes: [
    {
      id: 'a',
      label: 'A',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 80 },
      ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
    },
    {
      id: 'b',
      label: 'B',
      position: { x: 200, y: 0 },
      size: { width: 100, height: 80 },
      ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
    },
    {
      id: 'c',
      label: 'C',
      position: { x: 200, y: 150 },
      size: { width: 100, height: 80 },
      ports: [
        { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
        { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
      ],
    },
  ],
  edges: [
    { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } },
    { id: 'ac', source: { node: 'a', port: 'out' }, target: { node: 'c', port: 'in' } },
    { id: 'cb', source: { node: 'c', port: 'out' }, target: { node: 'b', port: 'in' } },
  ],
};

test('adding a port detaches its anchor, validates atomically and is one undo transaction', () => {
  const initial = createEditor(graph);
  const anchor = { x: 0.1, y: 0.8 };
  const port: Port = {
    id: 'extra',
    label: 'Extra',
    kind: 'input',
    side: 'left',
    anchor,
  };
  const event = { type: 'PortAdded', nodeId: 'a', port } as const;
  const added = updateEditor(initial, event);
  expect(added.graph.nodes[0]?.ports.at(-1)).toEqual(port);
  expect(added.graph.nodes[0]?.ports.at(-1)).not.toBe(port);
  anchor.x = 0.9;
  expect(added.graph.nodes[0]?.ports.at(-1)?.anchor).toEqual({ x: 0.1, y: 0.8 });
  expect(added.past).toHaveLength(1);
  expect(added.revision).toBe(initial.revision + 1);
  expect(parseGraph(serializeGraph(added.graph))).toEqual(added.graph);
  expect(
    updateEditor(updateEditor(added, { type: 'UndoPressed' }), { type: 'RedoPressed' }).graph,
  ).toEqual(added.graph);
  expect(updateEditor(added, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  expect(() => updateEditor(added, event)).toThrow();
  expect(() => updateEditor(initial, { ...event, nodeId: 'missing' })).toThrow();
  expect(() =>
    updateEditor(initial, { ...event, port: { ...port, anchor: { x: 2, y: 0 } } }),
  ).toThrow();
  expect(initial.graph).toEqual(graph);
  expect(updateEditor({ ...initial, readOnly: true }, event).graph).toBe(initial.graph);
  const busy = updateEditor(initial, { type: 'PanStarted', pointer: 1, point: { x: 0, y: 0 } });
  expect(updateEditor(busy, event)).toBe(busy);
});

test('port removal authorizes all attached edges before one atomic publication', () => {
  const state = {
    ...createEditor(graph),
    selectedNodes: ['a'],
    selectedEdges: ['ab', 'cb'],
    routes: [
      {
        id: 'ab',
        points: [
          { x: 100, y: 40 },
          { x: 200, y: 40 },
        ],
      },
    ],
  };
  const remove = { type: 'PortRemoved', endpoint: { node: 'a', port: 'out' } } as const;
  let candidateEdges: readonly string[] = [];
  const blocked = updateEditor(state, remove, {
    canDelete: (candidate) => {
      candidateEdges = candidate.edges.map(({ id }) => id);
      return candidate.edges.some(({ id }) => id === 'ac') ? 'Required connection' : null;
    },
  });
  expect(candidateEdges).toEqual(['ab', 'ac']);
  expect(blocked.notice).toBe('Required connection');
  expect(blocked.graph).toBe(state.graph);
  expect(blocked.routes).toBe(state.routes);
  expect(blocked.past).toBe(state.past);
  expect(blocked.revision).toBe(state.revision);
  const removed = updateEditor(state, remove);
  expect(removed.graph.nodes[0]?.ports).toEqual([]);
  expect(removed.graph.edges.map(({ id }) => id)).toEqual(['cb']);
  expect(removed.selectedNodes).toEqual(['a']);
  expect(removed.selectedEdges).toEqual(['cb']);
  expect(removed.routes).toEqual([]);
  expect(removed.past).toHaveLength(1);
  expect(removed.revision).toBe(state.revision + 1);
  expect(updateEditor(removed, remove)).toBe(removed);
  expect(updateEditor(removed, { type: 'UndoPressed' }).graph).toEqual(state.graph);
  const readOnly = { ...state, readOnly: true };
  expect(updateEditor(readOnly, remove)).toBe(readOnly);
});

test('port label edits preserve wiring and identity, clear labels, and undo as one transaction', () => {
  const initial = createEditor(graph);
  const event = {
    type: 'PortLabelChanged',
    endpoint: { node: 'a', port: 'out' },
    label: 'Ready for review',
  } as const;
  const edited = updateEditor(initial, event);
  expect(edited.graph.nodes[0]?.ports).toEqual([
    { id: 'out', kind: 'output', side: 'right', offset: 0.5, label: 'Ready for review' },
  ]);
  expect(edited.graph.edges).toBe(initial.graph.edges);
  expect(edited.graph.nodes[1]).toBe(initial.graph.nodes[1]);
  expect(edited.past).toHaveLength(1);
  expect(edited.revision).toBe(initial.revision + 1);
  expect(updateEditor(edited, event)).toBe(edited);
  expect(parseGraph(serializeGraph(edited.graph))).toEqual(edited.graph);
  const undone = updateEditor(edited, { type: 'UndoPressed' });
  expect(undone.graph).toEqual(initial.graph);
  expect(updateEditor(undone, { type: 'RedoPressed' }).graph).toEqual(edited.graph);
  const empty = updateEditor(edited, { ...event, label: '' });
  expect(empty.graph.nodes[0]?.ports[0]?.label).toBe('');
  const cleared = updateEditor(edited, { ...event, label: undefined });
  expect(cleared.graph.nodes[0]?.ports[0]).not.toHaveProperty('label');
  expect(cleared.graph.edges).toBe(initial.graph.edges);
  expect(updateEditor(cleared, { type: 'UndoPressed' }).graph).toEqual(edited.graph);
  expect(updateEditor(initial, { ...event, endpoint: { node: 'a', port: 'missing' } })).toBe(
    initial,
  );
  expect(updateEditor(initial, { ...event, endpoint: { node: 'missing', port: 'out' } })).toBe(
    initial,
  );
  const readOnly = { ...initial, readOnly: true };
  expect(updateEditor(readOnly, event)).toBe(readOnly);
  const busy = updateEditor(initial, { type: 'PanStarted', pointer: 1, point: { x: 0, y: 0 } });
  expect(updateEditor(busy, event)).toBe(busy);
  const invalid = JSON.parse(
    '{"type":"PortLabelChanged","endpoint":{"node":"a","port":"out"},"label":42}',
  );
  expect(() => updateEditor(initial, invalid)).toThrow();
  expect(initial.graph).toEqual(graph);
});
