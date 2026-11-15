import { expect, test } from 'bun:test';

import {
  captureConnectionDocument,
  createEditor,
  createEditorFromConnectionDocument,
  parseConnectionDocument,
  resolveConnectionCreation,
  resolveEdgeReconnection,
  serializeConnectionDocument,
  updateEditor,
  type EditorEvent,
  type EditorPolicy,
  type EditorState,
  type Endpoint,
  type Port,
  type ZlozConnectionMode,
  type ZlozGraph,
} from '../src/index';
import looseWire from './fixtures/connection-v2-loose.json';

const graph: ZlozGraph = {
  nodes: ['a', 'b', 'c'].map((id, index) => ({
    id,
    label: id,
    position: { x: index * 200, y: 0 },
    size: { width: 100, height: 80 },
    ports: [
      { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
      { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
    ],
  })),
  edges: [],
};
const endpoint = (node: string, port = 'in'): Endpoint => ({ node, port });
const initial = (connectionMode: ZlozConnectionMode = 'loose') =>
  createEditorFromConnectionDocument(captureConnectionDocument({ graph, connectionMode }));
const event: Extract<EditorEvent, { type: 'ConnectionCreated' }> = {
  type: 'ConnectionCreated',
  edge: {
    id: 'authored',
    source: endpoint('a'),
    target: endpoint('b'),
    label: 'Uses',
    data: { authored: true },
    architecture: { family: 'ddd', scope: 'strategic', role: 'shared-kernel' },
  },
};

// Expected cases are independent of the implementation's resolver.
const cases: readonly [ZlozConnectionMode, Port['kind'], Port['kind'], boolean][] = [
  ['strict', 'input', 'input', false],
  ['strict', 'input', 'output', false],
  ['strict', 'output', 'input', true],
  ['strict', 'output', 'output', false],
  ['loose', 'input', 'input', true],
  ['loose', 'input', 'output', true],
  ['loose', 'output', 'input', true],
  ['loose', 'output', 'output', true],
];
for (const [mode, sourceKind, targetKind, allowed] of cases) {
  test(`${mode} editor commits ${sourceKind} to ${targetKind}: ${allowed}`, () => {
    const state = initial(mode);
    const created = {
      ...event,
      edge: {
        ...event.edge,
        source: endpoint('a', sourceKind === 'input' ? 'in' : 'out'),
        target: endpoint('b', targetKind === 'input' ? 'in' : 'out'),
      },
    };
    if (!allowed) {
      expect(() => updateEditor(state, created)).toThrow();
      return;
    }
    const next = updateEditor(state, created);
    expect(next.graph.edges).toEqual([created.edge]);
    expect(next.graph.edges[0]!.source).not.toBe(created.edge.source);
    expect(next.graph.edges[0]!.data).not.toBe(created.edge.data);
    expect(next.past).toEqual([state.graph]);
    expect(next.future).toEqual([]);
    expect(next.revision).toBe(1);
    expect(next.connectionMode).toBe(mode);
    const undone = updateEditor(next, { type: 'UndoPressed' });
    expect(undone.graph).toEqual(state.graph);
    expect(undone.past).toEqual([]);
    expect(undone.connectionMode).toBe(mode);
    expect(undone.revision).toBe(2);
    const redone = updateEditor(undone, { type: 'RedoPressed' });
    expect(redone.graph).toEqual(next.graph);
    expect(redone.connectionMode).toBe(mode);
    expect(redone.revision).toBe(3);
    expect(captureConnectionDocument(redone).connectionMode).toBe(mode);
  });
}

test('explicit document initialization detaches authored data and retains mode/camera through save and reopen; legacy stays strict', () => {
  const document = parseConnectionDocument(JSON.stringify(looseWire));
  const state = createEditorFromConnectionDocument(document);
  expect(state.graph).toEqual(document.graph);
  expect(state.graph).not.toBe(document.graph);
  expect(state.graph.nodes[0]).not.toBe(document.graph.nodes[0]);
  expect(state.graph.nodes[0]!.data).not.toBe(document.graph.nodes[0]!.data);
  expect(state.viewport).toEqual(document.viewport!);
  expect(state.connectionMode).toBe('loose');
  expect(createEditorFromConnectionDocument(document, { viewport: undefined }).viewport).toEqual(
    document.viewport!,
  );
  expect(state.past).toEqual([]);
  expect(state.revision).toBe(0);
  expect(
    createEditorFromConnectionDocument(document, { viewport: { x: 1, y: 2, zoom: 1 } }).viewport,
  ).toEqual({ x: 1, y: 2, zoom: 1 });
  const reopened = createEditorFromConnectionDocument(
    parseConnectionDocument(serializeConnectionDocument(captureConnectionDocument(state))),
  );
  expect(reopened.graph).toEqual(document.graph);
  expect(reopened.connectionMode).toBe('loose');
  expect(() => createEditor(document.graph)).toThrow();
  expect(createEditor(graph).connectionMode).toBe('strict');
  expect(() => {
    // @ts-expect-error Deliberate future-mode input must reject at runtime as well as compile time.
    return createEditorFromConnectionDocument({ ...document, connectionMode: 'future' });
  }).toThrow();
  const { connectionMode: _mode, ...missing } = document;
  // @ts-expect-error A v2 initializer requires an explicit persisted mode.
  expect(() => createEditorFromConnectionDocument(missing)).toThrow();
});

test('creation rechecks source, target and global policy on the live graph; rejection preserves graph/history/revision and redo', () => {
  const created = updateEditor(initial(), event);
  const state = updateEditor(created, { type: 'UndoPressed' });
  const staged = updateEditor(state, { type: 'PortActivated', endpoint: endpoint('a') });
  const choice = resolveConnectionCreation(staged).target.entries.find(
    ({ endpoint: value }) => value.node === 'b' && value.port === 'in',
  )!;
  expect(choice.reason).toBeNull();
  for (const denied of ['a', 'b', 'global']) {
    const calls: string[] = [];
    const policy: EditorPolicy = {
      canConnectPort: (port, current) => {
        expect(current).toBe(staged.graph);
        calls.push(port.node);
        return port.node === denied ? `${denied} protected` : null;
      },
      canConnect: (_edge, current) => {
        expect(current).toEqual(staged.graph);
        calls.push('global');
        return 'global protected';
      },
    };
    const next = updateEditor(staged, choice.event, policy);
    expect(next.notice).toBe(`${denied} protected`);
    expect(calls).toEqual(
      denied === 'a' ? ['a'] : denied === 'b' ? ['a', 'b'] : ['a', 'b', 'global'],
    );
    expect(next.graph).toBe(staged.graph);
    expect(next.past).toBe(staged.past);
    expect(next.future).toBe(staged.future);
    expect(next.revision).toBe(staged.revision);
  }
  const edited = updateEditor(staged, { type: 'NodeLabelChanged', id: 'b', label: 'Latest' });
  const latest = updateEditor(edited, { type: 'PortActivated', endpoint: endpoint('a') });
  const denied = updateEditor(latest, choice.event, {
    canConnect: (_edge, current) => (current.nodes[1]!.label === 'Latest' ? 'Latest rule' : null),
  });
  expect(denied.notice).toBe('Latest rule');
  expect(denied.graph).toBe(latest.graph);
  const missing = updateEditor(staged, { type: 'PortRemoved', endpoint: endpoint('a') });
  expect(updateEditor(missing, choice.event).graph).toBe(missing.graph);
});

for (const end of ['source', 'target'] as const) {
  test(`loose reconnection ${end} preserves metadata, rechecks only the changed port, and commits once`, () => {
    const state = updateEditor(initial(), event);
    const old = state.graph.edges[0]!;
    const calls: string[] = [];
    const policy: EditorPolicy = {
      canReconnect: (edge, changed, current) => {
        expect(edge).toBe(old);
        expect(changed).toBe(end);
        expect(current).toBe(state.graph);
        calls.push('reconnect');
        return null;
      },
      canConnectPort: (port, current) => {
        expect(port).toEqual(endpoint('c', 'out'));
        expect(current).toBe(state.graph);
        calls.push('port');
        return null;
      },
      canConnect: (edge, current) => {
        expect(edge.id).toBe('authored');
        expect(current.edges).toEqual([]);
        expect(current.nodes).toBe(state.graph.nodes);
        calls.push('global');
        return null;
      },
    };
    const change = {
      type: 'EdgeReconnected',
      id: 'authored',
      end,
      endpoint: endpoint('c', 'out'),
    } as const;
    const next = updateEditor(state, change, policy);
    expect(calls).toEqual(['reconnect', 'port', 'global']);
    expect(next.graph.edges).toEqual([{ ...old, [end]: change.endpoint }]);
    expect(next.past).toEqual([...state.past, state.graph]);
    expect(next.revision).toBe(state.revision + 1);
    expect(next.connectionMode).toBe('loose');
    expect(updateEditor(next, change)).toBe(next);
    const undone = updateEditor(next, { type: 'UndoPressed' });
    expect(undone.graph).toBe(state.graph);
    expect(undone.connectionMode).toBe('loose');
    expect(updateEditor(undone, { type: 'RedoPressed' }).graph).toEqual(next.graph);
    const choice = resolveEdgeReconnection(state, 'authored', end)!.entries.find(
      ({ endpoint: value }) => value.node === 'c' && value.port === 'out',
    )!;
    expect(choice.reason).toBeNull();
    for (const policy of [
      { canReconnect: () => 'Locked' },
      { canConnectPort: () => 'Locked' },
      { canConnect: () => 'Locked' },
    ]) {
      const denied = updateEditor(state, choice.event, policy);
      expect(denied.notice).toBe('Locked');
      expect(denied.graph).toBe(state.graph);
      expect(denied.past).toBe(state.past);
      expect(denied.revision).toBe(state.revision);
    }
    const removed = updateEditor(state, { type: 'PortRemoved', endpoint: endpoint('c', 'out') });
    const stale = updateEditor(removed, choice.event);
    expect(stale.graph).toBe(removed.graph);
    expect(stale.past).toBe(removed.past);
    expect(stale.notice).toBe('Choose a compatible port.');
  });
}

test('loose duplicate protection stays ordered, replacement-aware and short circuits global policy', () => {
  const state = updateEditor(initial(), event);
  const next = updateEditor(
    state,
    { ...event, edge: { ...event.edge, id: 'other' } },
    {
      canConnect: () => {
        throw new Error('Duplicate reached policy');
      },
    },
  );
  expect(next.graph).toBe(state.graph);
  expect(next.notice).toBe('These ports are already connected');
  const reverse = updateEditor(state, {
    ...event,
    edge: { ...event.edge, id: 'reverse', source: event.edge.target, target: event.edge.source },
  });
  expect(reverse.graph.edges).toHaveLength(2);
  const conflict = updateEditor(reverse, {
    type: 'EdgeReconnected',
    id: 'reverse',
    end: 'source',
    endpoint: event.edge.source,
  });
  const duplicate = updateEditor(
    conflict,
    { type: 'EdgeReconnected', id: 'reverse', end: 'target', endpoint: event.edge.target },
    {
      canConnect: () => {
        throw new Error('Duplicate reached policy');
      },
    },
  );
  expect(duplicate.graph).toBe(conflict.graph);
  expect(duplicate.notice).toBe('These ports are already connected');
});

test('read-only, active gesture and absent targets cannot commit stale creation/reconnection choices', () => {
  const state = updateEditor(initial(), event);
  const guardedStates: readonly EditorState[] = [
    { ...state, readOnly: true },
    {
      ...state,
      gesture: { type: 'pan', pointer: 9, origin: { x: 0, y: 0 }, before: state.viewport },
    },
  ];
  for (const guarded of guardedStates) {
    for (const change of [
      { ...event, edge: { ...event.edge, id: 'next', target: endpoint('c') } },
      { type: 'EdgeReconnected', id: 'authored', end: 'target', endpoint: endpoint('c') } as const,
    ]) {
      const next = updateEditor(guarded, change);
      expect(next.graph).toBe(guarded.graph);
      expect(next.past).toBe(guarded.past);
      expect(next.revision).toBe(guarded.revision);
    }
  }
  expect(() =>
    updateEditor(state, {
      ...event,
      edge: { ...event.edge, id: 'bad', target: endpoint('missing') },
    }),
  ).toThrow();
  expect(
    updateEditor(state, {
      type: 'EdgeReconnected',
      id: 'missing',
      end: 'target',
      endpoint: endpoint('c'),
    }),
  ).toBe(state);
});

test('loose chooser supports explicit source restaging and all port kinds while retaining visible/all scope', () => {
  const state = initial();
  expect(resolveConnectionCreation(state).source.entries).toHaveLength(6);
  const staged = updateEditor(state, { type: 'PortActivated', endpoint: endpoint('a') });
  expect(staged.connection).toEqual(endpoint('a'));
  expect(staged.past).toEqual([]);
  const sources = resolveConnectionCreation(staged);
  const restaged = updateEditor(
    staged,
    sources.source.entries.find(
      ({ endpoint: value }) => value.node === 'c' && value.port === 'out',
    )!.event,
  );
  expect(restaged.connection).toEqual(endpoint('c', 'out'));
  expect(restaged.graph.edges).toEqual([]);
  const hidden = { ...restaged, visibility: { hiddenNodeIds: ['b'] } };
  expect(
    resolveConnectionCreation(hidden).target.entries.some(
      ({ endpoint: value }) => value.node === 'b',
    ),
  ).toBe(false);
  expect(
    resolveConnectionCreation(hidden, {}, { scope: 'all' }).target.entries.filter(
      ({ endpoint: value }) => value.node === 'b',
    ),
  ).toHaveLength(2);
  const next = updateEditor(
    restaged,
    sources.target.entries.find(
      ({ endpoint: value }) => value.node === 'b' && value.port === 'out',
    )!.event,
  );
  expect(next.graph.edges[0]).toMatchObject({
    source: endpoint('c', 'out'),
    target: endpoint('b', 'out'),
  });
});

test('loose pointer intents use current source and policies again on release and reject stale reconnection', () => {
  const start = updateEditor(initial(), {
    type: 'ConnectionDragStarted',
    endpoint: endpoint('a'),
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  expect(start.gesture.type).toBe('connection-drag');
  const moved = updateEditor(start, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 100, y: 0 },
    target: endpoint('b', 'out'),
  });
  expect(moved.gesture).toMatchObject({ target: endpoint('b', 'out') });
  const denied = updateEditor(
    moved,
    { type: 'PointerReleased', pointer: 1 },
    { canConnectPort: (port) => (port.node === 'a' ? 'Source locked on release' : null) },
  );
  expect(denied.graph).toBe(start.graph);
  expect(denied.past).toEqual([]);
  const next = updateEditor(moved, { type: 'PointerReleased', pointer: 1 });
  expect(next.graph.edges[0]).toMatchObject({
    source: endpoint('a'),
    target: endpoint('b', 'out'),
  });
  expect(next.past).toHaveLength(1);
  const reconnect = updateEditor(next, {
    type: 'ReconnectionDragStarted',
    id: 'edge:1',
    end: 'source',
    pointer: 2,
    point: { x: 0, y: 0 },
  });
  const hovered = updateEditor(reconnect, {
    type: 'PointerMoved',
    pointer: 2,
    point: { x: 200, y: 0 },
    target: endpoint('c'),
  });
  const locked = updateEditor(
    hovered,
    { type: 'PointerReleased', pointer: 2 },
    { canReconnect: () => 'Now locked' },
  );
  expect(locked.graph).toBe(next.graph);
  expect(locked.notice).toBe('Now locked');
  const committed = updateEditor(hovered, { type: 'PointerReleased', pointer: 2 });
  expect(committed.graph.edges[0]).toMatchObject({
    source: endpoint('c'),
    target: endpoint('b', 'out'),
  });
  expect(committed.past).toHaveLength(2);
  const stale = updateEditor(
    { ...hovered, graph: { ...hovered.graph, edges: [] } },
    { type: 'PointerReleased', pointer: 2 },
  );
  expect(stale.graph.edges).toEqual([]);
  expect(stale.past).toBe(hovered.past);
});

test('session mode survives normal edits, movement, clipboard and history limits without weakening legacy codecs', () => {
  let state = updateEditor(initial(), event);
  state = updateEditor(state, { type: 'EdgeDataChanged', id: 'authored', data: { updated: true } });
  state = updateEditor(state, { type: 'NodeSelected', id: 'a', additive: false });
  state = updateEditor(state, { type: 'SelectionNudged', delta: { x: 10, y: 0 } });
  state = updateEditor(state, { type: 'NodeSelected', id: 'b', additive: true });
  state = updateEditor(state, { type: 'CopyPressed' });
  state = updateEditor(state, { type: 'PastePressed' });
  expect(state.graph.edges).toHaveLength(2);
  expect(state.connectionMode).toBe('loose');
  expect(state.graph.nodes[0]!.position.x).toBe(10);
  const disabled = createEditorFromConnectionDocument(
    captureConnectionDocument({ graph, connectionMode: 'loose' }),
    { historyLimit: 0 },
  );
  const created = updateEditor(disabled, event);
  expect(created.graph.edges).toHaveLength(1);
  expect(created.past).toEqual([]);
  expect(updateEditor(created, { type: 'UndoPressed' })).toBe(created);
});

for (const sourcePort of ['in', 'out'])
  for (const targetPort of ['in', 'out']) {
    test(`loose reconnects either end while preserving ordered ${sourcePort} to ${targetPort}`, () => {
      const state = updateEditor(initial(), {
        ...event,
        edge: {
          ...event.edge,
          source: endpoint('a', sourcePort),
          target: endpoint('b', targetPort),
        },
      });
      for (const end of ['source', 'target'] as const) {
        const change = {
          type: 'EdgeReconnected',
          id: 'authored',
          end,
          endpoint: endpoint('c', end === 'source' ? sourcePort : targetPort),
        } as const;
        const next = updateEditor(state, change);
        expect(next.graph.edges).toEqual([{ ...state.graph.edges[0]!, [end]: change.endpoint }]);
        expect(next.past.length).toBe(state.past.length + 1);
        expect(updateEditor(next, { type: 'UndoPressed' }).graph).toBe(state.graph);
      }
    });
  }

test('strict editor reconnect rejection and legacy states without mode retain existing behavior', () => {
  const state = updateEditor(createEditor(graph), {
    ...event,
    edge: { ...event.edge, source: endpoint('a', 'out') },
  });
  const { connectionMode: _mode, ...legacy } = state;
  const change = {
    type: 'EdgeReconnected',
    id: 'authored',
    end: 'target',
    endpoint: endpoint('c', 'out'),
  } as const;
  const denied = updateEditor(legacy, change);
  expect(denied.graph).toBe(legacy.graph);
  expect(denied.notice).toBe('Choose a compatible port.');
  expect(denied.past).toBe(legacy.past);
  expect(
    resolveEdgeReconnection(legacy, 'authored', 'target')!.entries.some(
      ({ endpoint: value }) => value.port === 'out',
    ),
  ).toBe(false);
  expect(
    resolveConnectionCreation(legacy).source.entries.every(
      ({ endpoint: value }) => value.port === 'out',
    ),
  ).toBe(true);
  expect(() =>
    updateEditor(legacy, { ...event, edge: { ...event.edge, id: 'loose-only' } }),
  ).toThrow();
});

test('source staging, loose self-connections, cancellation and rejected release do not manufacture history', () => {
  const before = initial();
  const locked = updateEditor(
    before,
    { type: 'PortActivated', endpoint: endpoint('a') },
    { canConnectPort: () => 'Source locked' },
  );
  expect(locked.connection).toBeNull();
  expect(locked.graph).toBe(before.graph);
  const staged = updateEditor(before, { type: 'PortActivated', endpoint: endpoint('a') });
  const cancelled = updateEditor(staged, { type: 'GestureCancelled' });
  expect(cancelled.connection).toBeNull();
  expect(cancelled.graph).toBe(before.graph);
  expect(cancelled.past).toEqual([]);
  const self = updateEditor(staged, { type: 'PortActivated', endpoint: endpoint('a') });
  expect(self.graph.edges[0]).toMatchObject({ source: endpoint('a'), target: endpoint('a') });
  expect(self.past).toHaveLength(1);
  const start = updateEditor(before, {
    type: 'ConnectionDragStarted',
    endpoint: endpoint('a'),
    pointer: 4,
    point: { x: 0, y: 0 },
  });
  const cancelledDrag = updateEditor(start, { type: 'PointerReleased', pointer: 4 });
  expect(cancelledDrag.graph).toBe(before.graph);
  expect(cancelledDrag.past).toEqual([]);
  expect(cancelledDrag.gesture.type).toBe('idle');
});

test('mode-aware detachment revalidates serialized graph data and rejects invalid authored geometry', () => {
  // Legacy copyGraph validated both sides of JSON detachment; retain that guarantee.
  const overridden = { ...graph, toJSON: () => ({ nodes: [], edges: [event.edge] }) };
  expect(() => createEditor(overridden)).toThrow();
  const state = updateEditor(initial(), event);
  const invalid = { ...graph.nodes[0]!, id: 'new', position: { x: NaN, y: 0 } };
  expect(() => updateEditor(state, { type: 'NodeAdded', node: invalid })).toThrow();
  expect(state.past).toHaveLength(1);
});
