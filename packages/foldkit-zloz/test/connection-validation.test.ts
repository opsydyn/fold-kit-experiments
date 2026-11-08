import { expect, test } from 'bun:test';

import {
  createEditor,
  resolveConnectionCreation,
  resolveEdgeReconnection,
  type EditorPolicy,
  type ZlozGraph,
} from '../src/index';

const graph: ZlozGraph = {
  nodes: ['a', 'b', 'c'].map((id) => ({
    id,
    label: id,
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    ports: [
      { id: 'out', kind: 'output' as const, side: 'right' as const, offset: 0.5 },
      { id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 },
    ],
  })),
  edges: [
    { id: 'edge:1', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } },
    { id: 'edge:3', source: { node: 'b', port: 'out' }, target: { node: 'c', port: 'in' } },
  ],
};

test('creation preserves policy order, short circuits duplicates and allocates the first ID gap', () => {
  const state = { ...createEditor(graph), connection: { node: 'a', port: 'out' } };
  const calls: string[] = [];
  const policy: EditorPolicy = {
    canConnectPort: ({ node, port }, current) => {
      expect(current).toBe(state.graph);
      calls.push(`${node}/${port}`);
      return null;
    },
    canConnect: (edge, current) => {
      expect(edge.id).toBe('edge:2');
      expect(current.nodes).toBe(state.graph.nodes);
      expect(current.edges).toEqual(graph.edges);
      calls.push(`global/${edge.target.node}`);
      return edge.target.node === 'a' ? 'Self denied.' : null;
    },
  };
  expect(
    resolveConnectionCreation(state, policy).target.entries.map(({ reason }) => reason),
  ).toEqual(['Self denied.', 'These ports are already connected', null]);
  expect(calls).toEqual([
    'a/out',
    'a/out',
    'b/out',
    'c/out',
    'a/out',
    'a/in',
    'global/a',
    'a/out',
    'b/in',
    'a/out',
    'c/in',
    'global/c',
  ]);
  // No permission or duplicate decision survives a resolver call, even for the same state.
  const denied = resolveConnectionCreation(state, { canConnect: () => 'New rule.' });
  expect(denied.target.entries.map(({ reason }) => reason)).toEqual([
    'New rule.',
    'These ports are already connected',
    'New rule.',
  ]);
  const changed = {
    ...state,
    graph: {
      ...graph,
      edges: [
        ...graph.edges,
        { id: 'edge:2', source: state.connection, target: { node: 'c', port: 'in' } },
      ],
    },
  };
  expect(resolveConnectionCreation(changed).target.entries[2]?.reason).toBe(
    'These ports are already connected',
  );
});

test('reconnection evaluates only the changed port, with original port graph and replacement-free global graph', () => {
  for (const end of ['source', 'target'] as const) {
    const state = createEditor(graph);
    const calls: string[] = [];
    const policy: EditorPolicy = {
      canConnectPort: ({ node, port }, current) => {
        expect(current).toBe(state.graph);
        calls.push(`${node}/${port}`);
        return node === 'c' ? 'C locked.' : null;
      },
      canConnect: (edge, current) => {
        expect(edge.id).toBe('edge:1');
        expect(current.nodes).toBe(state.graph.nodes);
        expect(current.edges).toEqual([graph.edges[1]!]);
        calls.push(`global/${edge[end].node}`);
        return 'Global denied.';
      },
    };
    const context = resolveEdgeReconnection(state, 'edge:1', end, policy)!;
    expect(context.entries.map(({ reason }) => reason)).toEqual(
      end === 'source'
        ? [null, 'Global denied.', 'C locked.']
        : ['Global denied.', null, 'C locked.'],
    );
    expect(calls).toEqual(
      end === 'source' ? ['b/out', 'global/b', 'c/out'] : ['a/in', 'global/a', 'c/in'],
    );
  }
});

test('duplicate indexes distinguish arbitrary node and port identities on all four endpoint components', () => {
  const unusual: ZlozGraph = {
    nodes: [
      ...graph.nodes,
      ...(
        [
          ['a:out', 'x', 'output'],
          ['a', 'out:x', 'output'],
          ['b:in', 'y', 'input'],
          ['b', 'in:y', 'input'],
        ] as const
      ).map(([id, port, kind]) => ({
        ...graph.nodes[0]!,
        id,
        ports: [{ id: port, kind, side: 'right' as const, offset: 0.5 }],
      })),
    ].filter((node) => !['a', 'b'].includes(node.id) || node.ports.length === 1),
    edges: [
      { id: 'edge:1', source: { node: 'a:out', port: 'x' }, target: { node: 'b:in', port: 'y' } },
    ],
  };
  const initial = createEditor(unusual);
  const staged = { ...initial, connection: { node: 'a', port: 'out:x' } };
  expect(
    resolveConnectionCreation(staged).target.entries.every(({ reason }) => reason === null),
  ).toBe(true);
  const sameSource = { ...initial, connection: unusual.edges[0]!.source };
  expect(resolveConnectionCreation(sameSource).target.entries.map(({ reason }) => reason)).toEqual([
    null,
    'These ports are already connected',
    null,
  ]);
  const reconnected = resolveEdgeReconnection(initial, 'edge:1', 'target')!;
  expect(reconnected.entries.every(({ reason }) => reason === null)).toBe(true);
});

test('stale duplicate node and port IDs retain first-match compatibility checks', () => {
  const initial = createEditor(graph);
  const stale = {
    ...initial,
    connection: { node: 'a', port: 'out' },
    graph: {
      ...initial.graph,
      nodes: [
        {
          ...graph.nodes[0]!,
          ports: [
            { ...graph.nodes[0]!.ports[0]!, kind: 'input' as const },
            ...graph.nodes[0]!.ports,
          ],
        },
        ...graph.nodes,
      ],
    },
  };
  expect(resolveConnectionCreation(stale).target.reason).toBe('Choose a compatible output port.');
  const target = resolveEdgeReconnection(stale, 'edge:1', 'target')!;
  expect(target.entries.find(({ endpoint }) => endpoint.node === 'c')?.reason).toBe(
    'Choose a compatible port.',
  );
});
