import { describe, expect, test } from 'bun:test';

import fc from 'fast-check';

import { edgeGeometry, minimapGeometry } from '../src/geometry';
import {
  applyLayout,
  createEditor,
  edgePath,
  fitViewport,
  layoutRequest,
  parseGraph,
  parseSnapshot,
  portPosition,
  serializeGraph,
  serializeSnapshot,
  screenToWorld,
  updateEditor,
  zoomAt,
  type FlowGraph,
  type EditorPolicy,
  type EditorEvent,
  type LayoutResult,
} from '../src/index';

export const graph: FlowGraph = {
  nodes: [
    {
      id: 'a',
      label: 'Source',
      position: { x: 20, y: 30 },
      size: { width: 120, height: 80 },
      ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
    },
    {
      id: 'b',
      label: 'Sink',
      position: { x: 300, y: 60 },
      size: { width: 160, height: 100 },
      ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
    },
  ],
  edges: [],
};
const nodeA = graph.nodes[0];
const nodeB = graph.nodes[1];
if (!nodeA || !nodeB) throw new Error('Fixture requires two nodes');

describe('parent-owned editor', () => {
  test('a drag is one undo transaction; cancelling restores the starting position', () => {
    let state = createEditor(graph);
    state = updateEditor(state, {
      type: 'NodeDragStarted',
      id: 'a',
      pointer: 1,
      point: { x: 50, y: 60 },
    });
    state = updateEditor(state, { type: 'PointerMoved', pointer: 1, point: { x: 80, y: 90 } });
    state = updateEditor(state, { type: 'PointerMoved', pointer: 1, point: { x: 100, y: 100 } });
    expect(state.graph.nodes[0]?.position).toEqual({ x: 70, y: 70 });
    expect(state.past).toHaveLength(0);
    state = updateEditor(state, { type: 'PointerReleased', pointer: 1 });
    expect(state.past).toHaveLength(1);
    const revision = state.revision;
    state = updateEditor(state, { type: 'UndoPressed' });
    expect(state.graph.nodes[0]?.position).toEqual({ x: 20, y: 30 });
    expect(state.revision).toBeGreaterThan(revision);
    state = updateEditor(state, { type: 'RedoPressed' });
    expect(state.graph.nodes[0]?.position).toEqual({ x: 70, y: 70 });
    state = updateEditor(state, {
      type: 'NodeDragStarted',
      id: 'a',
      pointer: 1,
      point: { x: 0, y: 0 },
    });
    state = updateEditor(state, { type: 'PointerMoved', pointer: 1, point: { x: 200, y: 200 } });
    state = updateEditor(state, { type: 'GestureCancelled' });
    expect(state.graph.nodes[0]?.position).toEqual({ x: 70, y: 70 });
    expect(state.past).toHaveLength(1);
    expect(graph.nodes[0]?.position).toEqual({ x: 20, y: 30 });
  });

  test('foreign pointers cannot replace or finish a drag; displacement respects zoom', () => {
    let state = createEditor(graph, { viewport: { x: 0, y: 0, zoom: 2 } });
    state = updateEditor(state, {
      type: 'NodeDragStarted',
      id: 'a',
      pointer: 1,
      point: { x: 0, y: 0 },
    });
    const active = state;
    state = updateEditor(state, {
      type: 'NodeDragStarted',
      id: 'b',
      pointer: 2,
      point: { x: 0, y: 0 },
    });
    state = updateEditor(state, { type: 'PointerMoved', pointer: 2, point: { x: 100, y: 100 } });
    state = updateEditor(state, { type: 'PointerReleased', pointer: 2 });
    expect(state).toBe(active);
    state = updateEditor(state, { type: 'PointerMoved', pointer: 1, point: { x: 100, y: 40 } });
    expect(state.graph.nodes[0]?.position).toEqual({ x: 70, y: 50 });
  });

  test('deletion protection checks descendants and incident edges before committing', () => {
    const edge = {
      id: 'ab',
      source: { node: 'a', port: 'out' },
      target: { node: 'b', port: 'in' },
    };
    const initial = createEditor({
      nodes: [
        {
          id: 'g',
          kind: 'group',
          label: 'Group',
          position: { x: 0, y: 0 },
          size: { width: 200, height: 180 },
          ports: [],
        },
        { ...nodeA, parentId: 'g' },
        nodeB,
      ],
      edges: [edge],
    });
    const selected = updateEditor(initial, { type: 'NodeSelected', id: 'g', additive: false });
    const protectedLink = {
      canConnect: () => null,
      canDelete: (candidate: FlowGraph) =>
        candidate.edges.some((item) => item.id === 'ab') ? 'Required link' : null,
    };
    const protectedChild = {
      canConnect: () => null,
      canDelete: (candidate: FlowGraph) =>
        candidate.nodes.some((item) => item.id === 'a') ? 'Required child' : null,
    };
    for (const [policy, reason] of [
      [protectedLink, 'Required link'],
      [protectedChild, 'Required child'],
    ] as const) {
      const rejected = updateEditor(selected, { type: 'DeletePressed' }, policy);
      expect(rejected.graph).toBe(selected.graph);
      expect(rejected.revision).toBe(selected.revision);
      expect(rejected.past).toBe(selected.past);
      expect(rejected.future).toBe(selected.future);
      expect(rejected.selectedNodes).toEqual(['g']);
      expect(rejected.notice).toBe(reason);
    }
    const rejectedEdge = updateEditor(selected, { type: 'EdgeDeleted', id: 'ab' }, protectedLink);
    expect(rejectedEdge.graph).toBe(selected.graph);
    expect(rejectedEdge.notice).toBe('Required link');
    const allowed = updateEditor(selected, { type: 'DeletePressed' });
    expect(allowed.graph.nodes.map((node) => node.id)).toEqual(['b']);
    expect(allowed.graph.edges).toEqual([]);
    expect(allowed.past).toHaveLength(1);
    expect(updateEditor(allowed, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  });

  test('connection policy is app-owned and deletion removes incident edges atomically', () => {
    const edge = {
      id: 'ab',
      source: { node: 'a', port: 'out' },
      target: { node: 'b', port: 'in' },
    };
    let state = createEditor(graph);
    const denied = updateEditor(
      state,
      { type: 'ConnectionCreated', edge },
      { canConnect: () => 'Forbidden in this workflow' },
    );
    expect(denied.graph.edges).toEqual([]);
    expect(denied.notice).toBe('Forbidden in this workflow');
    state = updateEditor(state, { type: 'ConnectionCreated', edge });
    expect(state.graph.edges).toEqual([edge]);
    state = updateEditor(state, { type: 'NodeSelected', id: 'a', additive: false });
    state = updateEditor(state, { type: 'DeletePressed' });
    expect(state.graph.nodes.map((n) => n.id)).toEqual(['b']);
    expect(state.graph.edges).toEqual([]);
    state = updateEditor(state, { type: 'UndoPressed' });
    expect(state.graph.nodes).toHaveLength(2);
    expect(state.graph.edges).toEqual([edge]);
  });

  test('read-only mode allows inspection and viewport changes but blocks edits and history', () => {
    const state = createEditor(graph, { readOnly: true });
    expect(updateEditor(state, { type: 'NodeAdded', node: { ...nodeA, id: 'c' } })).toBe(state);
    expect(
      updateEditor(state, { type: 'NodeDragStarted', id: 'a', pointer: 1, point: { x: 0, y: 0 } }),
    ).toBe(state);
    expect(updateEditor(state, { type: 'UndoPressed' })).toBe(state);
    const selected = updateEditor(state, { type: 'NodeSelected', id: 'a', additive: false });
    expect(selected.selectedNodes).toEqual(['a']);
    expect(updateEditor(selected, { type: 'DeletePressed' })).toBe(selected);
  });
});

describe('layout publication', () => {
  test('rejects stale graph and superseded request results, including undo and measurements', () => {
    const original = createEditor(graph);
    const request = layoutRequest(original, 'first');
    const result: LayoutResult = {
      requestId: request.requestId,
      revision: request.revision,
      positions: graph.nodes.map((n) => ({ id: n.id, x: n.position.x + 100, y: n.position.y })),
      routes: [],
    };
    const selected = updateEditor(original, { type: 'NodeSelected', id: 'a', additive: false });
    const moved = updateEditor(selected, { type: 'SelectionNudged', delta: { x: 10, y: 0 } });
    const undone = updateEditor(moved, { type: 'UndoPressed' });
    expect(applyLayout(undone, request, result)).toBe(undone);
    expect(applyLayout(original, { ...request, requestId: 'newer' }, result)).toBe(original);
    const measured = updateEditor(original, {
      type: 'NodeMeasured',
      id: 'a',
      size: { width: 120, height: 140 },
    });
    expect(applyLayout(measured, request, result)).toBe(measured);
    const applied = applyLayout(original, request, result);
    expect(applied.graph.nodes[0]?.position.x).toBe(120);
    expect(applied.past).toHaveLength(1);
  });

  test('rejects incomplete or non-finite layouts without partially changing the graph', () => {
    const state = createEditor(graph);
    const request = layoutRequest(state, 'layout');
    expect(() =>
      applyLayout(state, request, {
        requestId: 'layout',
        revision: 0,
        positions: [{ id: 'a', x: 1, y: 2 }],
        routes: [],
      }),
    ).toThrow('every node');
    expect(() =>
      applyLayout(state, request, {
        requestId: 'layout',
        revision: 0,
        positions: [
          { id: 'a', x: Number.NaN, y: 0 },
          { id: 'b', x: 0, y: 0 },
        ],
        routes: [],
      }),
    ).toThrow('finite');
    expect(state.graph).toEqual(graph);
  });
});

test('arbitrary edit sequences round-trip through history and JSON without mutating the source', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.integer({ min: -100, max: 100 }).filter((n) => n !== 0),
        { minLength: 1, maxLength: 20 },
      ),
      (deltas) => {
        let state = createEditor(graph, { historyLimit: 20 });
        state = updateEditor(state, { type: 'NodeSelected', id: 'a', additive: false });
        for (const x of deltas)
          state = updateEditor(state, { type: 'SelectionNudged', delta: { x, y: 0 } });
        const final = state.graph;
        expect(parseGraph(serializeGraph(final))).toEqual(final);
        expect(graph.nodes[0]?.position).toEqual({ x: 20, y: 30 });
        for (const _ of deltas) state = updateEditor(state, { type: 'UndoPressed' });
        expect(state.graph).toEqual(graph);
        for (const _ of deltas) state = updateEditor(state, { type: 'RedoPressed' });
        expect(state.graph).toEqual(final);
      },
    ),
    { numRuns: 100 },
  );
});

test('zoom keeps the world point under the cursor even when the zoom limit clamps', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: -1000, max: 1000 }),
      fc.integer({ min: 1, max: 400 }),
      fc.integer({ min: 1, max: 1000 }),
      (x, zoom, factor) => {
        const viewport = { x, y: -x, zoom: zoom / 100 < 0.1 ? 0.1 : zoom / 100 };
        const cursor = { x: 200, y: 150 };
        const before = screenToWorld(cursor, viewport);
        const after = screenToWorld(cursor, zoomAt(viewport, cursor, factor / 100));
        expect(after.x).toBeCloseTo(before.x, 8);
        expect(after.y).toBeCloseTo(before.y, 8);
      },
    ),
    { numRuns: 100 },
  );
});

test('serialization round trips only the versioned graph and rejects broken endpoints', () => {
  expect(parseGraph(serializeGraph(graph))).toEqual(graph);
  expect(() => parseGraph('{"version":2,"graph":{}}')).toThrow('version');
  expect(() =>
    parseGraph(
      '{"version":1,"graph":{"nodes":[],"edges":[{"id":"bad","source":{"node":"missing","port":"p"},"target":{"node":"missing","port":"p"}}]}}',
    ),
  ).toThrow();
  expect(() => createEditor({ nodes: [...graph.nodes, nodeA], edges: [] })).toThrow('Duplicate');
});

test('geometry honours port sides and fit includes the complete node bounds', () => {
  expect(portPosition(nodeA, 'out')).toEqual({ x: 140, y: 70 });
  const viewport = fitViewport(graph, { width: 640, height: 400 }, 20);
  for (const node of graph.nodes) {
    expect(node.position.x * viewport.zoom + viewport.x).toBeGreaterThanOrEqual(19.99);
    expect((node.position.x + node.size.width) * viewport.zoom + viewport.x).toBeLessThanOrEqual(
      620.01,
    );
  }
});

test('node width remains undoable after the browser reports a new content height', () => {
  const before = createEditor(graph);
  const resized = updateEditor(before, { type: 'NodeWidthChanged', id: 'a', width: 240 });
  const measured = updateEditor(resized, {
    type: 'NodeMeasured',
    id: 'a',
    size: { width: 240, height: 100 },
  });
  expect(parseGraph(serializeGraph(measured.graph)).nodes[0]?.size.width).toBe(240);
  const undone = updateEditor(measured, { type: 'UndoPressed' });
  expect(undone.graph.nodes[0]?.size.width).toBe(120);
  expect(updateEditor(undone, { type: 'RedoPressed' }).graph.nodes[0]?.size.width).toBe(240);
});

test('edge metadata is persisted and undoable without moving endpoints', () => {
  const edge = { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } };
  const before = createEditor({ ...graph, edges: [edge] });
  const styled = updateEditor(before, { type: 'EdgeDataChanged', id: 'ab', data: 'dashed' });
  expect(parseGraph(serializeGraph(styled.graph)).edges).toEqual([{ ...edge, data: 'dashed' }]);
  expect(updateEditor(styled, { type: 'UndoPressed' }).graph.edges).toEqual([edge]);
});

test('resize previews respect zoom, cancel cleanly and commit one undo step', () => {
  const initial = createEditor(graph, { viewport: { x: 0, y: 0, zoom: 2 } });
  const started = updateEditor(initial, {
    type: 'NodeResizeStarted',
    id: 'a',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const preview = updateEditor(started, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 100, y: 0 },
  });
  expect(preview.graph.nodes[0]?.size.width).toBe(170);
  expect(preview.past).toHaveLength(0);
  expect(updateEditor(preview, { type: 'GestureCancelled' }).graph).toEqual(initial.graph);
  const completed = updateEditor(preview, { type: 'PointerReleased', pointer: 1 });
  expect(completed.past).toHaveLength(1);
  expect(updateEditor(completed, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
});

test('connection drag previews only eligible targets and commits through normal history', () => {
  const initial = createEditor(graph);
  const point = { x: 20, y: 30 };
  const started = updateEditor(initial, {
    type: 'ConnectionDragStarted',
    endpoint: { node: 'a', port: 'out' },
    pointer: 1,
    point,
  });
  const overInput = {
    type: 'PointerMoved' as const,
    target: { node: 'b', port: 'in' },
    pointer: 1,
    point,
  };
  const blocked = updateEditor(started, overInput, { canConnect: () => 'Blocked' });
  expect(updateEditor(blocked, { type: 'PointerReleased', pointer: 1 }).graph).toEqual(
    initial.graph,
  );
  const preview = updateEditor(started, overInput);
  expect(preview.graph).toEqual(initial.graph);
  expect(updateEditor(preview, { type: 'GestureCancelled' }).connection).toBeNull();
  const result = updateEditor(preview, { type: 'PointerReleased', pointer: 1 });
  expect(result.graph.edges).toHaveLength(1);
  expect(result.notice).toBe('Connection created');
  expect(updateEditor(result, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
});

test('nearby drop candidates skip denied ports while exact hits retain rejection feedback', () => {
  const initial = createEditor({ ...graph, nodes: [...graph.nodes, { ...nodeB, id: 'c' }] });
  const point = { x: 100, y: 100 };
  const source = { node: 'a', port: 'out' };
  const blocked = { node: 'b', port: 'in' };
  const allowed = { node: 'c', port: 'in' };
  const policy: EditorPolicy = {
    canConnect: (edge) => (edge.target.node === blocked.node ? 'Blocked target' : null),
  };
  const started = updateEditor(initial, {
    type: 'ConnectionDragStarted',
    endpoint: source,
    pointer: 1,
    point,
  });
  const move = {
    type: 'PointerMoved',
    pointer: 1,
    point,
    nearbyTargets: [blocked, allowed],
  } as const;
  const exact = updateEditor(started, { ...move, target: blocked }, policy);
  expect(exact.gesture).toMatchObject({
    target: null,
    rejected: { endpoint: blocked, reason: 'Blocked target' },
  });
  const nearby = updateEditor(started, move, policy);
  expect(nearby.gesture).toMatchObject({ target: allowed });
  expect(nearby.graph).toBe(initial.graph);
  const committed = updateEditor(nearby, { type: 'PointerReleased', pointer: 1 }, policy);
  expect(committed.graph.edges[0]).toMatchObject({ source, target: allowed });
  expect(committed.past).toHaveLength(1);
});

test('port permissions guard wire starts, drops and direct edits without changing existing edges', () => {
  const initial = createEditor({ ...graph, nodes: [...graph.nodes, { ...nodeB, id: 'c' }] });
  const source = { node: 'a', port: 'out' };
  const target = { node: 'b', port: 'in' };
  const alternate = { node: 'c', port: 'in' };
  const edge = { id: 'ab', source, target };
  const point = { x: 100, y: 100 };
  const activateSource = { type: 'PortActivated', endpoint: source } as const;
  const drag = { type: 'ConnectionDragStarted', pointer: 1, point, endpoint: source } as const;
  const release = { type: 'PointerReleased', pointer: 1 } as const;
  const outputLocked: EditorPolicy = {
    canConnectPort: ({ node }) => (node === source.node ? 'Output is locked' : null),
  };
  const inputLocked: EditorPolicy = {
    canConnectPort: ({ node }) => (node === target.node ? 'Input is locked' : null),
  };
  for (const event of [activateSource, drag]) {
    const denied = updateEditor(initial, event, outputLocked);
    expect(denied.connection).toBeNull();
    expect(denied.gesture.type).toBe('idle');
    expect(denied.notice).toBe('Output is locked');
  }
  const armed = updateEditor(initial, activateSource, inputLocked);
  const refused = updateEditor(armed, { type: 'PortActivated', endpoint: target }, inputLocked);
  expect(refused.graph).toBe(initial.graph);
  expect(refused.notice).toBe('Input is locked');
  expect(updateEditor(initial, { type: 'ConnectionCreated', edge }, outputLocked).graph).toBe(
    initial.graph,
  );

  const started = updateEditor(initial, drag, inputLocked);
  const move = { type: 'PointerMoved', pointer: 1, point } as const;
  const exact = updateEditor(started, { ...move, target }, inputLocked);
  expect(exact.gesture).toMatchObject({
    target: null,
    rejected: { endpoint: target, reason: 'Input is locked' },
  });
  const nearby = updateEditor(
    started,
    { ...move, nearbyTargets: [target, alternate] },
    inputLocked,
  );
  expect(nearby.gesture).toMatchObject({ target: alternate });
  expect(updateEditor(nearby, release, outputLocked).graph).toBe(initial.graph);
  expect(updateEditor(nearby, release, inputLocked).graph.edges[0]?.target).toEqual(alternate);

  const existing = createEditor({ ...initial.graph, edges: [edge] });
  const reconnect = { type: 'EdgeReconnected', id: edge.id, end: 'target' } as const;
  const moved = updateEditor(existing, { ...reconnect, endpoint: alternate }, outputLocked);
  expect(moved.graph.edges).toEqual([{ ...edge, target: alternate }]);
  const denied = updateEditor(moved, { ...reconnect, endpoint: target }, inputLocked);
  expect(denied.graph).toBe(moved.graph);
  expect(denied.revision).toBe(moved.revision);
  expect(denied.past).toBe(moved.past);
  expect(denied.notice).toBe('Input is locked');
});

test('reconnecting an edge preserves identity and data, and rejects incompatible or denied ports', () => {
  const target = { node: 'b', port: 'in' };
  const edge = { id: 'ab', source: { node: 'a', port: 'out' }, target, data: 'dashed' };
  const sink = graph.nodes.find((node) => node.id === 'b');
  if (!sink) throw new Error('Missing sink fixture');
  const initial = createEditor({ nodes: [...graph.nodes, { ...sink, id: 'c' }], edges: [edge] });
  const event = {
    type: 'EdgeReconnected' as const,
    id: edge.id,
    end: 'target' as const,
    endpoint: { node: 'c', port: 'in' },
  };
  expect(updateEditor(initial, { ...event, endpoint: edge.source }).graph).toEqual(initial.graph);
  expect(updateEditor(initial, event, { canConnect: () => 'Denied' }).graph).toEqual(initial.graph);
  const updated = updateEditor(initial, event);
  expect(updated.graph.edges).toEqual([{ ...edge, target: event.endpoint }]);
  expect(updateEditor(updated, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
});

test('reconnection policy protects one endpoint across drag and direct edits', () => {
  const edge = { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } };
  const initial = createEditor({
    nodes: [
      ...graph.nodes,
      { ...nodeA, id: 'alternate-source' },
      { ...nodeB, id: 'alternate-target' },
    ],
    edges: [edge],
  });
  const lockedSource: EditorPolicy = {
    canReconnect: (current, end) =>
      current.id === edge.id && end === 'source' ? 'Source is locked' : null,
  };
  const start = {
    type: 'ReconnectionDragStarted',
    id: edge.id,
    end: 'source',
    pointer: 1,
    point: { x: 100, y: 100 },
  } as const;
  const blockedStart = updateEditor(initial, start, lockedSource);
  expect(blockedStart.gesture.type).toBe('idle');
  expect(blockedStart.notice).toBe('Source is locked');
  const denied = updateEditor(
    initial,
    {
      type: 'EdgeReconnected',
      id: edge.id,
      end: 'source',
      endpoint: { node: 'alternate-source', port: 'out' },
    },
    lockedSource,
  );
  expect(denied.graph).toBe(initial.graph);
  expect(denied.past).toBe(initial.past);
  expect(denied.revision).toBe(initial.revision);
  expect(denied.notice).toBe('Source is locked');

  const started = updateEditor(initial, { ...start, end: 'target' }, lockedSource);
  const endpoint = { node: 'alternate-target', port: 'in' };
  const move = {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 200, y: 100 },
    target: endpoint,
  } as const;
  const ready = updateEditor(started, move, lockedSource);
  const lockedTarget: EditorPolicy = {
    canReconnect: (current, end, currentGraph) =>
      current === currentGraph.edges[0] && end === 'target' ? 'Target is locked' : null,
  };
  const cancelled = updateEditor(started, move, lockedTarget);
  expect(cancelled.gesture.type).toBe('idle');
  expect(cancelled.connection).toBeNull();
  expect(cancelled.notice).toBe('Target is locked');

  const release = { type: 'PointerReleased', pointer: 1 } as const;
  const deniedRelease = updateEditor(ready, release, lockedTarget);
  expect(deniedRelease.gesture.type).toBe('idle');
  expect(deniedRelease.graph).toBe(initial.graph);
  expect(deniedRelease.past).toBe(initial.past);
  expect(deniedRelease.notice).toBe('Target is locked');
  const updated = updateEditor(ready, release, lockedSource);
  expect(updated.graph.edges).toEqual([{ ...edge, target: endpoint }]);
  expect(updated.past).toHaveLength(1);
  expect(updateEditor(updated, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
});

test('dragging either edge endpoint preserves the original edge until a valid drop', () => {
  const edge = { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } };
  const initial = createEditor({ ...graph, edges: [edge] });
  const point = { x: 30, y: 30 };
  const started = updateEditor(initial, {
    type: 'ReconnectionDragStarted',
    id: 'ab',
    end: 'source',
    pointer: 1,
    point,
  });
  expect(started.connection).toEqual(edge.target);
  const wrongPort = updateEditor(started, {
    type: 'PointerMoved',
    pointer: 1,
    point,
    target: edge.target,
  });
  expect(updateEditor(wrongPort, { type: 'PointerReleased', pointer: 1 }).graph).toEqual(
    initial.graph,
  );
  expect(updateEditor(started, { type: 'GestureCancelled' }).graph).toEqual(initial.graph);
});

test('resize permission blocks explicit dimension edits and restores an in-flight resize', () => {
  const group = {
    id: 'g',
    kind: 'group' as const,
    label: 'Group',
    position: { x: 0, y: 0 },
    size: { width: 250, height: 200 },
    ports: [],
  };
  const initial = createEditor({
    nodes: [group, { ...nodeA, parentId: group.id, expandParent: true }, nodeB],
    edges: [],
  });
  const policy: EditorPolicy = {
    canResizeNode: (node) => (node.id === 'a' || node.id === 'g' ? 'Size is locked.' : null),
  };
  const start = { type: 'NodeResizeStarted', id: 'a', pointer: 1, point: { x: 0, y: 0 } } as const;
  const blocked = updateEditor(initial, start, policy);
  expect(blocked.gesture.type).toBe('idle');
  expect(blocked.notice).toBe('Size is locked.');
  const events: EditorEvent[] = [
    { type: 'NodeWidthChanged', id: 'a', width: 300 },
    { type: 'NodeResizeNudged', id: 'a', delta: 40 },
    { type: 'GroupDimensionChanged', id: 'g', dimension: 'height', value: 320 },
    { type: 'GroupResizeNudged', id: 'g', delta: { x: 40, y: 20 } },
    { type: 'GroupFitClicked', id: 'g' },
  ];
  for (const event of events) {
    const denied = updateEditor(initial, event, policy);
    expect(denied.graph).toBe(initial.graph);
    expect(denied.past).toBe(initial.past);
    expect(denied.notice).toBe('Size is locked.');
  }
  const lockedParent: EditorPolicy = {
    canResizeNode: (node) => (node.id === 'g' ? 'Parent size is locked.' : null),
  };
  expect(updateEditor(initial, events[0]!, lockedParent).notice).toBe('Parent size is locked.');
  const preview = updateEditor(updateEditor(initial, start), {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 180, y: 0 },
  });
  expect(preview.graph).not.toBe(initial.graph);
  const reverted = updateEditor(preview, { type: 'PointerReleased', pointer: 1 }, lockedParent);
  expect(reverted.gesture.type).toBe('idle');
  expect(reverted.graph).toBe(initial.graph);
  expect(reverted.past).toBe(initial.past);
  const selected = updateEditor(initial, { type: 'NodeSelected', id: 'a', additive: false });
  const moved = updateEditor(selected, { type: 'SelectionNudged', delta: { x: 10, y: 0 } }, policy);
  expect(moved.graph.nodes.find((node) => node.id === 'a')?.position.x).toBe(nodeA.position.x + 10);
});

test('node movement policy blocks an entire selection or group and rolls back a denied drag', () => {
  const group = {
    id: 'group',
    kind: 'group' as const,
    label: 'Group',
    position: { x: 0, y: 0 },
    size: { width: 400, height: 300 },
    ports: [],
  };
  const initial = createEditor({
    nodes: [group, { ...nodeA, parentId: group.id }, nodeB],
    edges: [],
  });
  const selected = updateEditor(initial, { type: 'NodeSelected', id: group.id, additive: false });
  const policy: EditorPolicy = {
    canMoveNode: (node) => (node.id === 'a' ? 'Source is locked.' : null),
  };
  const drag = {
    type: 'NodeDragStarted',
    id: group.id,
    pointer: 1,
    point: { x: 20, y: 20 },
  } as const;
  const blocked = updateEditor(selected, drag, policy);
  expect(blocked.gesture.type).toBe('idle');
  expect(blocked.selectedNodes).toEqual([group.id]);
  expect(blocked.graph).toBe(initial.graph);
  expect(blocked.notice).toBe('Source is locked.');

  const mixed = updateEditor(selected, { type: 'NodeSelected', id: 'b', additive: true });
  const nudge = { type: 'SelectionNudged', delta: { x: 15, y: 0 } } as const;
  const denied = updateEditor(mixed, nudge, policy);
  expect(denied.graph).toBe(initial.graph);
  expect(denied.past).toBe(initial.past);
  expect(denied.revision).toBe(initial.revision);

  const started = updateEditor(selected, drag);
  const pointerMove = { type: 'PointerMoved', pointer: 1, point: { x: 65, y: 20 } } as const;
  const preview = updateEditor(started, pointerMove);
  expect(preview.graph).not.toBe(initial.graph);
  const release = { type: 'PointerReleased', pointer: 1 } as const;
  for (const event of [pointerMove, release]) {
    const cancelled = updateEditor(preview, event, policy);
    expect(cancelled.gesture.type).toBe('idle');
    expect(cancelled.graph).toBe(initial.graph);
    expect(cancelled.past).toBe(initial.past);
    expect(cancelled.notice).toBe('Source is locked.');
  }

  const movable = updateEditor(selected, { type: 'NodeSelected', id: 'b', additive: false });
  const moved = updateEditor(movable, nudge, policy);
  expect(moved.graph.nodes.find((node) => node.id === 'b')?.position.x).toBe(nodeB.position.x + 15);
  expect(updateEditor(moved, { type: 'UndoPressed' }).graph).toBe(initial.graph);
});

test('nested group moves include each descendant once and undo restores the hierarchy', () => {
  const boundary = {
    kind: 'group' as const,
    label: 'Boundary',
    size: { width: 700, height: 400 },
    position: { x: 0, y: 0 },
    ports: [],
  };
  const initial = createEditor({
    ...graph,
    nodes: [
      { ...boundary, id: 'outer' },
      { ...boundary, id: 'inner', parentId: 'outer' },
      ...graph.nodes.map((node) => ({ ...node, parentId: 'inner' })),
    ],
  });
  const selected = { ...initial, selectedNodes: ['outer', 'inner', 'a'] };
  const moved = updateEditor(selected, { type: 'SelectionNudged', delta: { x: 40, y: 0 } });
  expect(moved.graph.nodes.map((node) => node.position.x)).toEqual(
    initial.graph.nodes.map((node) => node.position.x + 40),
  );
  expect(parseGraph(serializeGraph(moved.graph))).toEqual(moved.graph);
  expect(updateEditor(moved, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  expect(updateEditor(selected, { type: 'DeletePressed' }).graph.nodes).toHaveLength(0);
  expect(() =>
    createEditor({
      nodes: [
        { ...boundary, id: 'outer', parentId: 'inner' },
        { ...boundary, id: 'inner', parentId: 'outer' },
      ],
      edges: [],
    }),
  ).toThrow('Group cycle');
});

test('group and ungroup preserve positions and edges while changing nested membership', () => {
  const boundary = {
    id: 'outer',
    kind: 'group' as const,
    label: 'Outer',
    position: { x: 0, y: 0 },
    size: { width: 600, height: 400 },
    ports: [],
  };
  const edge = { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } };
  const initial = createEditor({
    nodes: [boundary, ...graph.nodes.map((node) => ({ ...node, parentId: 'outer' }))],
    edges: [edge],
  });
  const selected = { ...initial, selectedNodes: ['a', 'b'] };
  const grouped = updateEditor(selected, { type: 'SelectionGrouped' });
  const inner = grouped.graph.nodes.find((node) => node.id === 'group:1');
  expect(inner?.parentId).toBe('outer');
  expect(grouped.graph.nodes.find((node) => node.id === 'a')?.parentId).toBe(inner?.id);
  expect(grouped.graph.edges).toEqual([edge]);
  expect(updateEditor(grouped, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  const ungrouped = updateEditor(grouped, { type: 'SelectionUngrouped' });
  expect(ungrouped.graph).toEqual(initial.graph);
  expect(updateEditor(ungrouped, { type: 'UndoPressed' }).graph).toEqual(grouped.graph);
  const both = { ...grouped, selectedNodes: ['outer', 'group:1'] };
  expect(updateEditor(both, { type: 'SelectionUngrouped' }).graph).toEqual({
    ...graph,
    edges: [edge],
  });
});

test('selection policies guard direct, implicit and marquee selection', () => {
  const boundary = {
    id: 'g',
    kind: 'group' as const,
    label: 'Group',
    position: { x: 0, y: 0 },
    size: { width: 500, height: 300 },
    ports: [],
  };
  const edge = { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } };
  const initial = createEditor({
    nodes: [boundary, { ...nodeA, parentId: 'g' }, nodeB],
    edges: [edge],
  });
  const selected = updateEditor(initial, { type: 'NodeSelected', id: 'a', additive: false });
  const policy: EditorPolicy = {
    canSelectNode: (node) => (node.id === 'a' ? null : 'Node is excluded.'),
    canSelectEdge: () => 'Edge is excluded.',
  };
  const point = { x: 0, y: 0 };
  const events: EditorEvent[] = [
    { type: 'NodeSelected', id: 'b', additive: false },
    { type: 'NodeDragStarted', id: 'b', pointer: 1, point },
    { type: 'NodeResizeStarted', id: 'b', pointer: 1, point },
    { type: 'SelectionNudged', id: 'b', delta: { x: 5, y: 0 } },
    { type: 'EdgeSelected', id: 'ab', additive: true },
    { type: 'EdgeLabelEditingStarted', id: 'ab' },
    { type: 'ContextOpened', context: { kind: 'edge', id: 'ab', point } },
  ];
  for (const event of events) {
    const denied = updateEditor(selected, event, policy);
    expect(denied.selectedNodes).toEqual(['a']);
    expect(denied.selectedEdges).toEqual([]);
    expect(denied.gesture.type).toBe('idle');
    expect(denied.graph).toBe(initial.graph);
    expect(denied.context).toBeNull();
    expect(denied.edgeLabelDraft).toBeNull();
  }
  const start = updateEditor(initial, { type: 'BoxSelectionStarted', pointer: 1, point });
  const preview = updateEditor(start, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 600, y: 400 },
  });
  expect(
    updateEditor(preview, { type: 'PointerReleased', pointer: 1 }, policy).selectedNodes,
  ).toEqual(['a']);
  const copied = updateEditor(selected, { type: 'DuplicatePressed' }, policy);
  expect(copied.graph.nodes).toHaveLength(initial.graph.nodes.length + 1);
  expect(copied.selectedNodes).toEqual([]);
});

test('reverse box selection at zoom replaces selection only on release', () => {
  const initial = createEditor(graph, { viewport: { x: 25, y: 30, zoom: 2 } });
  const selected = { ...initial, selectedNodes: ['b'] };
  const started = updateEditor(selected, {
    type: 'BoxSelectionStarted',
    pointer: 1,
    point: { x: 310, y: 260 },
  });
  const preview = updateEditor(started, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 25, y: 30 },
  });
  expect(preview.selectedNodes).toEqual(['b']);
  expect(updateEditor(preview, { type: 'GestureCancelled' }).selectedNodes).toEqual(['b']);
  const result = updateEditor(preview, { type: 'PointerReleased', pointer: 1 });
  expect(result.selectedNodes).toEqual(['a']);
  expect(result.graph).toBe(initial.graph);
  expect(result.past).toHaveLength(0);
  expect(result.viewport).toEqual(initial.viewport);
});

test('partial marquee selects intersecting cards without swallowing their expanded group', () => {
  const initial = createEditor(
    {
      nodes: [
        {
          id: 'g',
          kind: 'group',
          label: 'Group',
          position: { x: 0, y: 0 },
          size: { width: 240, height: 200 },
          ports: [],
        },
        { ...nodeA, parentId: 'g' },
        nodeB,
      ],
      edges: [],
    },
    { viewport: { x: 25, y: 30, zoom: 2 } },
  );
  const draw = (
    state: typeof initial,
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) => {
    const started = updateEditor(state, { type: 'BoxSelectionStarted', pointer: 1, point: start });
    return updateEditor(started, { type: 'PointerMoved', pointer: 1, point: end });
  };
  const release = (state: typeof initial) =>
    updateEditor(state, { type: 'PointerReleased', pointer: 1 });
  const start = { x: 325, y: 170 };
  const end = { x: 205, y: 70 };
  expect(release(draw(initial, start, end)).selectedNodes).toEqual([]);
  const partial = updateEditor(initial, { type: 'BoxSelectionMatchChanged', match: 'partial' });
  const active = draw(partial, start, end);
  expect(active.selectedNodes).toEqual([]);
  expect(updateEditor(active, { type: 'BoxSelectionMatchChanged', match: 'full' })).toBe(active);
  const selected = release(active);
  expect(selected.selectedNodes).toEqual(['a']);
  expect(selected.graph).toBe(initial.graph);
  expect(selected.past).toBe(initial.past);
  expect(selected.revision).toBe(initial.revision);
  expect(release(draw(partial, { x: 305, y: 90 }, { x: 325, y: 150 })).selectedNodes).toEqual([]);
  expect(release(draw(partial, end, end)).selectedNodes).toEqual([]);
  expect(release(draw(partial, { x: 25, y: 30 }, { x: 505, y: 430 })).selectedNodes).toEqual(['g']);
  const collapsed = updateEditor(partial, { type: 'GroupCollapseToggled', id: 'g' });
  expect(release(draw(collapsed, start, end)).selectedNodes).toEqual(['g']);
});

test('minimap navigation centers the chosen map point without changing zoom or history', () => {
  const initial = createEditor(graph, { viewport: { x: 50, y: 30, zoom: 2 } });
  const state = updateEditor(initial, {
    type: 'SurfaceMeasured',
    size: { width: 800, height: 440 },
  });
  const before = minimapGeometry(state.graph, { width: 800, height: 440 }, state.viewport);
  const next = updateEditor(state, { type: 'MinimapClicked', point: { x: 0.8, y: 0.25 } });
  const center = screenToWorld({ x: 400, y: 220 }, next.viewport);
  expect(center.x).toBeCloseTo(before.x + before.width * 0.8);
  expect(center.y).toBeCloseTo(before.y + before.height * 0.25);
  expect(next.viewport.zoom).toBe(2);
  expect(next.graph).toBe(state.graph);
  expect(next.past).toBe(state.past);
});

test('fit control works on a small read-only canvas and leaves history intact', () => {
  const initial = createEditor(graph, { readOnly: true });
  expect(updateEditor(initial, { type: 'FitViewClicked' })).toBe(initial);
  const measured = updateEditor(initial, {
    type: 'SurfaceMeasured',
    size: { width: 48, height: 32 },
  });
  const fitted = updateEditor(measured, { type: 'FitViewClicked' });
  expect(fitted.viewport.zoom).toBeLessThan(initial.viewport.zoom);
  expect(fitted.graph).toBe(initial.graph);
  expect(fitted.past).toBe(initial.past);
});

test('custom zoom limits apply to wheel and pinch while preserving the world anchor', () => {
  const zoomLimits = { minZoom: 5, maxZoom: 8 };
  const initial = createEditor(graph, { zoomLimits });
  expect(initial.viewport.zoom).toBe(5);
  const point = { x: 100, y: 150 };
  const zoomed = updateEditor(initial, { type: 'Zoomed', point, factor: 10 });
  expect(zoomed.viewport).toEqual({ x: -60, y: -90, zoom: 8 });
  expect(screenToWorld(point, zoomed.viewport)).toEqual({ x: 20, y: 30 });
  const pinch = updateEditor(zoomed, { type: 'PinchStarted', center: point, distance: 100 });
  const moved = updateEditor(pinch, {
    type: 'PinchMoved',
    center: { x: 110, y: 170 },
    distance: 10,
  });
  expect(moved.viewport).toEqual({ x: 10, y: 20, zoom: 5 });
  expect(() =>
    updateEditor(initial, {
      type: 'ViewportChanged',
      viewport: { x: 0, y: 0, zoom: 4 },
    }),
  ).toThrow();
  expect(() => createEditor(graph, { zoomLimits: { minZoom: 3, maxZoom: 2 } })).toThrow();
  expect(() => createEditor(graph, { fitViewPadding: -1 })).toThrow();
});

test('Fit view uses authored padding and changing constraints cancels a running fit', () => {
  const zoomLimits = { minZoom: 0.75, maxZoom: 1.6 };
  const size = { width: 800, height: 440 };
  const measured = updateEditor(createEditor(graph, { zoomLimits, fitViewPadding: 100 }), {
    type: 'SurfaceMeasured',
    size,
  });
  const click = { type: 'FitViewClicked' } as const;
  const fitted = updateEditor(measured, click);
  expect(fitted.viewport.zoom).toBeCloseTo(600 / 440);
  expect(fitted.viewport.x + 20 * fitted.viewport.zoom).toBeCloseTo(100);
  expect(fitViewport(graph, size, 0, zoomLimits).zoom).toBe(1.6);
  const fitting = updateEditor(
    { ...fitted, viewport: measured.viewport, fitViewDuration: 400 },
    click,
  );
  const constrained = updateEditor(fitting, {
    type: 'ViewportConstraintsChanged',
    zoomLimits: { minZoom: 1.5, maxZoom: 1.5 },
    fitViewPadding: 0,
  });
  expect(constrained.viewport).toEqual({ x: -200, y: -110, zoom: 1.5 });
  expect(constrained.fitViewTransition.type).toBe('idle');
  expect(
    updateEditor(constrained, {
      type: 'FitViewAnimationFrame',
      id: fitting.fitViewTransition.id,
      time: 500,
      reducedMotion: true,
    }),
  ).toBe(constrained);
  expect(constrained.graph).toBe(measured.graph);
  expect(constrained.past).toBe(measured.past);
});

test('animated fit interpolates the camera and finishes at the instant fit target', () => {
  const initial = updateEditor(createEditor(graph, { fitViewDuration: 400 }), {
    type: 'SurfaceMeasured',
    size: { width: 800, height: 440 },
  });
  const click = { type: 'FitViewClicked' } as const;
  const target = updateEditor({ ...initial, fitViewDuration: 0 }, click).viewport;
  const fitting = updateEditor(initial, click);
  const frame = {
    type: 'FitViewAnimationFrame',
    id: fitting.fitViewTransition.id,
    reducedMotion: false,
  } as const;
  const start = updateEditor(fitting, { ...frame, time: 100 });
  const middle = updateEditor(start, { ...frame, time: 300 });
  const done = updateEditor(middle, { ...frame, time: 500 });

  expect(start.viewport).toEqual(initial.viewport);
  expect(middle.viewport).not.toEqual(start.viewport);
  expect(middle.viewport).not.toEqual(target);
  expect(done.viewport).toEqual(target);
  expect(done.fitViewTransition.type).toBe('idle');
  expect(done.graph).toBe(initial.graph);
  expect(done.past).toBe(initial.past);
  expect(done.revision).toBe(initial.revision);
  expect(updateEditor(fitting, { ...frame, time: 100, reducedMotion: true }).viewport).toEqual(
    target,
  );

  const interrupted = updateEditor(middle, { type: 'ViewportNudged', delta: { x: 12, y: 0 } });
  expect(interrupted.viewport.x).toBe(middle.viewport.x + 12);
  expect(updateEditor(interrupted, { ...frame, time: 500 })).toBe(interrupted);
  expect(updateEditor(updateEditor(middle, click), { ...frame, time: 500 }).viewport).toBe(
    middle.viewport,
  );
});

test('snapping at zoom moves the selected group and its contents by one common offset', () => {
  const boundary = {
    id: 'outer',
    kind: 'group' as const,
    label: 'Outer',
    position: { x: 7, y: 9 },
    size: { width: 600, height: 400 },
    ports: [],
  };
  const initial = createEditor(
    {
      nodes: [boundary, ...graph.nodes.map((node) => ({ ...node, parentId: 'outer' }))],
      edges: [],
    },
    { viewport: { x: 35, y: 50, zoom: 2 }, snapToGrid: true },
  );
  const selected = { ...initial, selectedNodes: ['a', 'outer'] };
  const started = updateEditor(selected, {
    type: 'NodeDragStarted',
    id: 'outer',
    pointer: 1,
    point: { x: 20, y: 20 },
  });
  const click = updateEditor(
    updateEditor(started, {
      type: 'PointerMoved',
      pointer: 1,
      point: { x: 20, y: 20 },
    }),
    { type: 'PointerReleased', pointer: 1 },
  );
  expect(click.graph).toBe(initial.graph);
  expect(click.past).toHaveLength(0);
  const preview = updateEditor(started, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 80, y: 42 },
  });
  const moved = updateEditor(preview, { type: 'PointerReleased', pointer: 1 });
  expect(moved.graph.nodes[0]?.position).toEqual({ x: 40, y: 20 });
  expect(moved.graph.nodes.map((node) => node.position)).toEqual(
    initial.graph.nodes.map((node) => ({ x: node.position.x + 33, y: node.position.y + 11 })),
  );
  expect(moved.past).toHaveLength(1);
  expect(updateEditor(moved, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
});

test('copy and paste remap a group and internal edge without copying its external edge', () => {
  const source = graph.nodes[0];
  if (!source) throw new Error('Missing source fixture');
  const internal = {
    id: 'internal',
    source: { node: 'a', port: 'out' },
    target: { node: 'b', port: 'in' },
  };
  const external = { ...internal, id: 'external', source: { ...internal.source, node: 'outside' } };
  const initial = createEditor({
    nodes: [
      {
        id: 'group',
        kind: 'group',
        label: 'Group',
        position: { x: 0, y: 0 },
        size: { width: 500, height: 300 },
        ports: [],
      },
      ...graph.nodes.map((node) => ({ ...node, parentId: 'group' })),
      { ...source, id: 'outside' },
    ],
    edges: [internal, external],
  });
  const selected = { ...initial, selectedNodes: ['group'] };
  const copied = updateEditor(selected, { type: 'CopyPressed' });
  expect(copied.past).toHaveLength(0);
  const pasted = updateEditor(copied, { type: 'PastePressed' });
  const [group, a, b] = pasted.graph.nodes.slice(initial.graph.nodes.length);
  expect(group?.id).not.toBe('group');
  expect(a?.parentId).toBe(group?.id);
  expect(b?.parentId).toBe(group?.id);
  expect(pasted.graph.edges).toHaveLength(3);
  expect(pasted.graph.edges.at(-1)).toMatchObject({
    source: { node: a?.id, port: 'out' },
    target: { node: b?.id, port: 'in' },
  });
  expect(updateEditor(pasted, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  const duplicated = updateEditor(selected, { type: 'DuplicatePressed' });
  expect(duplicated.graph).toEqual(pasted.graph);
  expect(duplicated.clipboard).toBeNull();
});

test('edge label edits publish once, preserve the route, and support undo and removal', () => {
  const id = 'ab';
  const edge = { id, source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } };
  let state: ReturnType<typeof createEditor> = {
    ...createEditor({ ...graph, edges: [edge] }),
    routes: [
      {
        id,
        points: [
          { x: 140, y: 70 },
          { x: 300, y: 110 },
        ],
      },
    ],
  };
  state = updateEditor(state, { type: 'EdgeLabelEditingStarted', id });
  state = updateEditor(state, { type: 'EdgeLabelDraftChanged', id, text: 'Discard' });
  state = updateEditor(state, { type: 'EdgeLabelCancelled', id });
  expect(state.graph.edges[0]).toEqual(edge);
  expect(state.past).toHaveLength(0);

  const routes = state.routes;
  state = updateEditor(state, { type: 'EdgeLabelEditingStarted', id });
  state = updateEditor(state, { type: 'EdgeLabelDraftChanged', id, text: ' Approve ' });
  state = updateEditor(state, { type: 'EdgeLabelSaved', id });
  expect(state.graph.edges[0]?.label).toBe('Approve');
  expect(state.routes).toBe(routes);
  expect(state.past).toHaveLength(1);

  state = updateEditor(state, { type: 'UndoPressed' });
  expect(state.graph.edges[0]).toEqual(edge);
  state = updateEditor(state, { type: 'RedoPressed' });
  expect(state.graph.edges[0]?.label).toBe('Approve');

  state = updateEditor(state, { type: 'EdgeLabelEditingStarted', id });
  state = updateEditor(state, { type: 'EdgeLabelDraftChanged', id, text: ' ' });
  state = updateEditor(state, { type: 'EdgeLabelSaved', id });
  expect(state.graph.edges[0]).toEqual(edge);
});

test('an authored edge path overrides layout and undo restores the automatic route', () => {
  const id = 'ab';
  const edge = { id, source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } };
  const routes = [
    {
      id,
      points: [
        { x: 140, y: 70 },
        { x: 300, y: 70 },
        { x: 300, y: 110 },
      ],
    },
  ];
  const automatic = { ...createEditor({ ...graph, edges: [edge] }), routes };
  const smooth = updateEditor(automatic, { type: 'EdgePathStyleChanged', id, pathStyle: 'smooth' });
  const saved = parseGraph(serializeGraph(smooth.graph));
  expect(saved.edges[0]?.pathStyle).toBe('smooth');
  const savedEdge = saved.edges[0];
  if (!savedEdge) throw new Error('Expected the saved edge');
  const route = routes[0]?.points;
  expect(edgePath(saved, savedEdge, route)).toContain('C');
  expect(edgeGeometry(saved, { ...savedEdge, pathStyle: 'stepped' }, route)).toEqual({
    path: 'M140,70 L220,70 L220,110 L300,110',
    center: { x: 220, y: 90 },
  });
  expect(edgePath(saved, { ...savedEdge, pathStyle: 'straight' }, route)).toBe('M140,70 L300,110');
  expect(() => parseGraph(serializeGraph(saved).replace('"smooth"', '"unknown"'))).toThrow();
  const undone = updateEditor(smooth, { type: 'UndoPressed' });
  expect(undone.routes).toEqual(routes);
  expect(undone.graph.edges[0]?.pathStyle).toBeUndefined();
});

test('deleting an edge by ID keeps other selected graph elements and is undoable', () => {
  const edge = { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } };
  const initial = createEditor({ ...graph, edges: [edge] });
  const selected = updateEditor(initial, { type: 'NodeSelected', id: 'a', additive: false });
  const removed = updateEditor(selected, { type: 'EdgeDeleted', id: edge.id });
  expect(removed.graph.edges).toEqual([]);
  expect(removed.graph.nodes).toEqual(initial.graph.nodes);
  expect(removed.selectedNodes).toEqual(['a']);
  expect(updateEditor(removed, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  const readOnly = createEditor(initial.graph, { readOnly: true });
  expect(updateEditor(readOnly, { type: 'EdgeDeleted', id: edge.id })).toBe(readOnly);
});

test('visibility is reversible session state shared by selection, fit and minimap navigation', () => {
  const outer = {
    id: 'outer',
    label: 'Outer',
    kind: 'group' as const,
    position: { x: 0, y: 0 },
    size: { width: 520, height: 240 },
    ports: [],
  };
  const edge = { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } };
  const surface = { width: 800, height: 440 };
  const initial = {
    ...createEditor({ nodes: [outer, { ...nodeA, parentId: 'outer' }, nodeB], edges: [edge] }),
    surface,
  };
  const selected = updateEditor(
    updateEditor(initial, { type: 'NodeSelected', id: 'a', additive: false }),
    { type: 'EdgeSelected', id: edge.id, additive: true },
  );
  const hidden = updateEditor(selected, {
    type: 'VisibilityChanged',
    visibility: { hiddenNodeIds: ['outer'] },
  });
  expect(hidden.graph).toBe(initial.graph);
  expect(hidden.revision).toBe(initial.revision);
  expect(hidden.past).toBe(initial.past);
  expect(hidden.selectedNodes).toEqual([]);
  expect(hidden.selectedEdges).toEqual([]);
  expect(updateEditor(hidden, { type: 'NodeSelected', id: 'a', additive: false })).toBe(hidden);
  expect(updateEditor(hidden, { type: 'EdgeSelected', id: edge.id, additive: false })).toBe(hidden);

  const reference = { ...createEditor({ nodes: [nodeB], edges: [] }), surface };
  const fit = { type: 'FitViewClicked' } as const;
  const click = { type: 'MinimapClicked', point: { x: 0.15, y: 0.3 } } as const;
  expect(updateEditor(hidden, fit).viewport).toEqual(updateEditor(reference, fit).viewport);
  expect(updateEditor(hidden, click).viewport).toEqual(updateEditor(reference, click).viewport);

  const started = updateEditor(hidden, {
    type: 'BoxSelectionStarted',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const moved = updateEditor(started, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 620, y: 300 },
  });
  expect(updateEditor(moved, { type: 'PointerReleased', pointer: 1 }).selectedNodes).toEqual(['b']);

  const reveal = updateEditor(hidden, { type: 'VisibilityChanged', visibility: {} });
  expect(reveal.graph).toBe(initial.graph);
  expect(
    updateEditor(reveal, { type: 'EdgeSelected', id: edge.id, additive: false }).selectedEdges,
  ).toEqual([edge.id]);
});

test('collapsing nested groups preserves the document and clears hidden selections', () => {
  const outer = {
    id: 'outer',
    label: 'Outer',
    kind: 'group' as const,
    position: { x: 0, y: 0 },
    size: { width: 520, height: 240 },
    ports: [],
  };
  const internal = {
    id: 'ab',
    source: { node: 'a', port: 'out' },
    target: { node: 'b', port: 'in' },
  };
  const initial = createEditor({
    nodes: [
      outer,
      { ...outer, id: 'inner', parentId: 'outer' },
      { ...nodeA, parentId: 'inner' },
      { ...nodeB, parentId: 'outer' },
    ],
    edges: [internal],
  });
  const selected = { ...initial, selectedNodes: ['a'], selectedEdges: ['ab'] };
  const inner = updateEditor(selected, { type: 'GroupCollapseToggled', id: 'inner' });
  expect(inner.selectedNodes).toEqual([]);
  expect(inner.selectedEdges).toEqual(['ab']);
  const collapsed = updateEditor(inner, { type: 'GroupCollapseToggled', id: 'outer' });
  expect(collapsed.selectedEdges).toEqual([]);
  expect(collapsed.graph).toBe(initial.graph);
  expect(collapsed.revision).toBe(initial.revision);
  expect(collapsed.past).toBe(initial.past);
  expect(
    updateEditor(collapsed, { type: 'GroupCollapseToggled', id: 'outer' }).collapsedGroups,
  ).toEqual(['inner']);
});

test('dropping into a nested group or outside it commits membership with position', () => {
  const outer = {
    id: 'outer',
    label: 'Outer',
    kind: 'group' as const,
    position: { x: 210, y: 0 },
    size: { width: 460, height: 280 },
    ports: [],
  };
  const initial = createEditor({
    ...graph,
    nodes: [
      ...graph.nodes,
      outer,
      { ...outer, id: 'inner', parentId: 'outer', position: { x: 260, y: 35 } },
    ],
  });
  const drag = (state: ReturnType<typeof createEditor>, from: number, to: number) => {
    const start = updateEditor(state, {
      type: 'NodeDragStarted',
      id: 'a',
      pointer: 1,
      point: { x: from, y: 55 },
    });
    return updateEditor(start, { type: 'PointerMoved', pointer: 1, point: { x: to, y: 55 } });
  };
  const release = (state: ReturnType<typeof createEditor>) =>
    updateEditor(state, { type: 'PointerReleased', pointer: 1 });
  const collapsed = updateEditor(initial, { type: 'GroupCollapseToggled', id: 'inner' });
  const droppedOnParent = release(drag(collapsed, 40, 300));
  expect(droppedOnParent.graph.nodes[0]?.parentId).toBe('outer');

  const groupDrag = updateEditor(initial, {
    type: 'NodeDragStarted',
    id: 'outer',
    pointer: 2,
    point: { x: 220, y: 20 },
  });
  const groupPreview = updateEditor(groupDrag, {
    type: 'PointerMoved',
    pointer: 2,
    point: { x: 300, y: 55 },
  });
  const movedGroup = updateEditor(groupPreview, { type: 'PointerReleased', pointer: 2 });
  expect(movedGroup.graph.nodes.find((node) => node.id === 'outer')?.parentId).toBeUndefined();
  expect(movedGroup.graph.nodes.find((node) => node.id === 'inner')?.parentId).toBe('outer');

  const preview = drag(initial, 40, 300);
  expect(preview.graph.nodes[0]?.parentId).toBeUndefined();
  expect(updateEditor(preview, { type: 'GestureCancelled' }).graph).toEqual(initial.graph);
  const inside = release(preview);
  expect(inside.graph.nodes[0]).toMatchObject({ parentId: 'inner', position: { x: 280, y: 30 } });
  expect(inside.past).toHaveLength(1);
  expect(updateEditor(inside, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  const outside = release(drag(inside, 300, 180));
  expect(outside.graph.nodes[0]).toMatchObject({ position: { x: 160, y: 30 } });
  expect(outside.graph.nodes[0]).not.toHaveProperty('parentId');
  expect(updateEditor(outside, { type: 'UndoPressed' }).graph).toEqual(inside.graph);
});

test('alignment snaps within a screen-pixel tolerance and overrides the grid only on its axis', () => {
  const target = { ...nodeB, position: { x: 280, y: 93 } };
  const start = (zoom: number) => {
    const initial = createEditor(
      { nodes: [nodeA, target], edges: [] },
      {
        snapToAlignment: true,
        snapToGrid: true,
        viewport: { x: 0, y: 0, zoom },
      },
    );
    return updateEditor(initial, {
      type: 'NodeDragStarted',
      id: 'a',
      pointer: 1,
      point: { x: 0, y: 0 },
    });
  };
  const drag = (zoom: number, y: number) =>
    updateEditor(start(zoom), {
      type: 'PointerMoved',
      pointer: 1,
      point: { x: 155 * zoom, y: y * zoom },
    });
  const aligned = drag(2, 61);
  expect(aligned.graph.nodes[0]?.position).toEqual({ x: 180, y: 93 });
  expect(aligned.gesture).toMatchObject({ guides: [{ axis: 'y', position: 93 }] });
  const saved = updateEditor(aligned, { type: 'PointerReleased', pointer: 1 });
  expect(saved.past).toHaveLength(1);
  expect(saved.gesture).toEqual({ type: 'idle' });
  expect(updateEditor(saved, { type: 'UndoPressed' }).graph).toEqual(start(2).graph);

  const centered = drag(2, 71);
  expect(centered.graph.nodes[0]?.position.y).toBe(103);
  expect(centered.gesture).toMatchObject({ guides: [{ axis: 'y', position: 143 }] });
  const cancelled = updateEditor(centered, { type: 'GestureCancelled' });
  expect(cancelled.graph).toEqual(start(2).graph);
  expect(cancelled.gesture).toEqual({ type: 'idle' });
  expect(drag(2, 59).graph.nodes[0]?.position.y).toBe(80);
  expect(drag(1, 59).graph.nodes[0]?.position.y).toBe(93);
});

test('auto-pan keeps a dragged node under its pointer and leaves viewport movement out of history', () => {
  const initial = createEditor(graph, { viewport: { x: 20, y: 10, zoom: 2 } });
  const start = updateEditor(initial, {
    type: 'NodeDragStarted',
    id: 'a',
    pointer: 1,
    point: { x: 75, y: 90 },
  });
  const moved = updateEditor(start, {
    type: 'DragPanned',
    pointer: 1,
    point: { x: 115, y: 90 },
    delta: { x: -30, y: 0 },
  });
  expect(moved.viewport).toEqual({ x: -10, y: 10, zoom: 2 });
  expect(moved.graph.nodes[0]?.position).toEqual({ x: 55, y: 30 });
  const stopped = updateEditor(moved, { type: 'PointerReleased', pointer: 1 });
  expect(stopped.past).toHaveLength(1);
  const undone = updateEditor(stopped, { type: 'UndoPressed' });
  expect(undone.graph).toEqual(initial.graph);
  expect(undone.viewport).toEqual(moved.viewport);
  expect(
    updateEditor(stopped, {
      type: 'DragPanned',
      pointer: 1,
      point: { x: 115, y: 90 },
      delta: { x: -30, y: 0 },
    }),
  ).toBe(stopped);
});

test('pinch cancels a graph drag and keeps the starting world point under the moving midpoint', () => {
  const initial = createEditor(graph, { viewport: { x: 20, y: 10, zoom: 2 } });
  const start = updateEditor(initial, {
    type: 'NodeDragStarted',
    id: 'a',
    pointer: 1,
    point: { x: 70, y: 90 },
  });
  const dragged = updateEditor(start, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 110, y: 90 },
  });
  expect(dragged.graph).not.toEqual(initial.graph);
  const pinch = updateEditor(dragged, {
    type: 'PinchStarted',
    center: { x: 120, y: 90 },
    distance: 100,
  });
  expect(pinch.graph).toEqual(initial.graph);
  const moved = updateEditor(pinch, {
    type: 'PinchMoved',
    center: { x: 150, y: 110 },
    distance: 150,
  });
  expect(moved.viewport).toEqual({ x: 0, y: -10, zoom: 3 });
  expect(updateEditor(moved, { type: 'PointerReleased', pointer: 1 })).toBe(moved);
  expect(updateEditor(moved, { type: 'GestureCancelled' }).viewport).toEqual(initial.viewport);
  const ended = updateEditor(moved, { type: 'PinchEnded' });
  expect(ended.viewport).toEqual(moved.viewport);
  expect(ended.past).toHaveLength(0);
});

test('parent extent clamps a selection together and prevents drag-out reparenting', () => {
  const parent = {
    id: 'parent',
    kind: 'group' as const,
    label: 'Parent',
    position: { x: 0, y: 0 },
    size: { width: 500, height: 240 },
    ports: [],
  };
  const initial = createEditor({
    nodes: [
      parent,
      { ...nodeA, parentId: 'parent', extent: 'parent' },
      { ...nodeB, parentId: 'parent' },
    ],
    edges: [],
  });
  expect(() =>
    createEditor({
      nodes: [{ ...nodeA, extent: 'parent' }],
      edges: [],
    }),
  ).toThrow('requires a parent');
  const movedParent = updateEditor(
    { ...initial, selectedNodes: ['parent', 'a'] },
    {
      type: 'SelectionNudged',
      delta: { x: 50, y: 50 },
    },
  );
  expect(movedParent.graph.nodes[1]?.position).toEqual({ x: 70, y: 80 });
  const copied = updateEditor({ ...initial, selectedNodes: ['a'] }, { type: 'CopyPressed' });
  expect(copied.clipboard?.nodes[0]).not.toHaveProperty('extent');
  const ungrouped = updateEditor(
    { ...initial, selectedNodes: ['parent'] },
    { type: 'SelectionUngrouped' },
  );
  expect(ungrouped.graph.nodes[0]).not.toHaveProperty('extent');
  const selected = { ...initial, selectedNodes: ['a', 'b'] };
  const nudged = updateEditor(selected, { type: 'SelectionNudged', delta: { x: -100, y: 200 } });
  expect(nudged.graph.nodes[1]?.position).toEqual({ x: 0, y: 160 });
  expect(nudged.graph.nodes[2]?.position).toEqual({ x: 280, y: 190 });
  const start = updateEditor(initial, {
    type: 'NodeDragStarted',
    id: 'a',
    pointer: 1,
    point: { x: 30, y: 40 },
  });
  const moved = updateEditor(start, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: -100, y: -100 },
  });
  expect(moved.graph.nodes[1]?.position).toEqual({ x: 0, y: 0 });
  const dropped = updateEditor(moved, { type: 'PointerReleased', pointer: 1 });
  expect(dropped.graph.nodes[1]?.parentId).toBe('parent');
  expect(updateEditor(dropped, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  expect(parseGraph(serializeGraph(dropped.graph))).toEqual(dropped.graph);
});

test('child growth expands opted-in ancestors in the same resize transaction', () => {
  const group = {
    kind: 'group' as const,
    label: 'Group',
    ports: [],
    position: { x: 0, y: 0 },
    size: { width: 200, height: 160 },
  };
  const initial = createEditor({
    nodes: [
      { ...group, id: 'outer' },
      { ...group, id: 'inner', parentId: 'outer', expandParent: true },
      { ...nodeA, parentId: 'inner', expandParent: true },
    ],
    edges: [],
  });
  const start = updateEditor(initial, {
    type: 'NodeResizeStarted',
    id: 'a',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const preview = updateEditor(start, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 180, y: 0 },
  });
  expect(preview.graph.nodes[0]?.size.width).toBe(352);
  expect(updateEditor(preview, { type: 'GestureCancelled' }).graph).toEqual(initial.graph);
  const released = updateEditor(preview, { type: 'PointerReleased', pointer: 1 });
  expect(released.past).toHaveLength(1);
  expect(updateEditor(released, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  const copied = updateEditor({ ...initial, selectedNodes: ['a'] }, { type: 'CopyPressed' });
  expect(copied.clipboard?.nodes[0]).not.toHaveProperty('expandParent');
  const resized = updateEditor(initial, { type: 'NodeWidthChanged', id: 'a', width: 300 });
  expect(resized.graph.nodes[1]?.size.width).toBe(336);
  expect(resized.graph.nodes[0]?.size.width).toBe(352);
  expect(resized.past).toHaveLength(1);
  expect(updateEditor(resized, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  const measured = updateEditor(resized, {
    type: 'NodeMeasured',
    id: 'a',
    size: { width: 300, height: 210 },
  });
  expect(measured.graph.nodes[1]?.size.height).toBe(256);
  expect(measured.graph.nodes[0]?.size.height).toBe(272);
  expect(parseGraph(serializeGraph(measured.graph))).toEqual(measured.graph);
});

test('fitting a group encloses hidden descendants without moving them and is undoable', () => {
  const initial = createEditor({
    nodes: [
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        position: { x: -100, y: -100 },
        size: { width: 1000, height: 800 },
        ports: [],
      },
      { ...nodeA, parentId: 'g' },
      { ...nodeB, parentId: 'g' },
    ],
    edges: [],
  });
  const collapsed = updateEditor(initial, { type: 'GroupCollapseToggled', id: 'g' });
  const fitted = updateEditor(collapsed, { type: 'GroupFitClicked', id: 'g' });
  expect(fitted.graph.nodes[0]).toMatchObject({
    position: { x: -4, y: -18 },
    size: { width: 488, height: 202 },
  });
  expect(fitted.graph.nodes.slice(1)).toEqual(initial.graph.nodes.slice(1));
  expect(fitted.collapsedGroups).toEqual(['g']);
  expect(fitted.past).toHaveLength(1);
  expect(updateEditor(fitted, { type: 'GroupFitClicked', id: 'g' })).toBe(fitted);
  expect(updateEditor(fitted, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  const readOnly = createEditor(initial.graph, { readOnly: true });
  expect(updateEditor(readOnly, { type: 'GroupFitClicked', id: 'g' })).toBe(readOnly);
});

test('fitting respects parent containment and can expand opted-in ancestors', () => {
  const boundary = { kind: 'group' as const, label: 'Group', ports: [] };
  const state = createEditor({
    nodes: [
      { ...boundary, id: 'outer', position: { x: 0, y: 0 }, size: { width: 300, height: 200 } },
      {
        ...boundary,
        id: 'inner',
        parentId: 'outer',
        extent: 'parent',
        position: { x: 20, y: 20 },
        size: { width: 250, height: 150 },
      },
      { ...nodeB, parentId: 'inner', position: { x: 400, y: 80 } },
    ],
    edges: [],
  });
  const blocked = updateEditor(state, { type: 'GroupFitClicked', id: 'inner' });
  expect(blocked.graph).toBe(state.graph);
  expect(blocked.past).toHaveLength(0);
  const enabled = updateEditor(state, { type: 'NodeExpansionToggled', id: 'inner' });
  const fitted = updateEditor(enabled, { type: 'GroupFitClicked', id: 'inner' });
  expect(fitted.graph.nodes[0]?.size.width).toBeGreaterThan(300);
  expect(fitted.graph.nodes[2]).toEqual(state.graph.nodes[2]);
  const outer = state.graph.nodes[0];
  if (!outer) throw new Error('Missing group fixture');
  const empty = createEditor({ nodes: [outer], edges: [] });
  expect(updateEditor(empty, { type: 'GroupFitClicked', id: 'outer' }).past).toHaveLength(0);
});

test('group handles resize both dimensions at zoom without moving children and commit once', () => {
  const initial = createEditor(
    {
      nodes: [
        {
          id: 'g',
          label: 'Group',
          kind: 'group',
          position: { x: 0, y: 0 },
          size: { width: 500, height: 300 },
          ports: [],
        },
        { ...nodeA, parentId: 'g', position: { x: 50, y: 60 } },
      ],
      edges: [],
    },
    { viewport: { x: 0, y: 0, zoom: 2 } },
  );
  const start = updateEditor(initial, {
    type: 'NodeResizeStarted',
    id: 'g',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  expect(updateEditor(start, { type: 'PointerMoved', pointer: 2, point: { x: 200, y: 100 } })).toBe(
    start,
  );
  const preview = updateEditor(start, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 200, y: 100 },
  });
  expect(preview.graph.nodes[0]?.size).toEqual({ width: 600, height: 350 });
  expect(preview.graph.nodes[1]).toEqual(initial.graph.nodes[1]);
  expect(preview.past).toHaveLength(0);
  expect(updateEditor(preview, { type: 'GestureCancelled' }).graph).toEqual(initial.graph);
  const released = updateEditor(preview, { type: 'PointerReleased', pointer: 1 });
  expect(released.past).toHaveLength(1);
  expect(updateEditor(released, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  expect(
    updateEditor(updateEditor(released, { type: 'UndoPressed' }), { type: 'RedoPressed' }).graph,
  ).toEqual(preview.graph);
  const shrink = updateEditor(start, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: -2000, y: -2000 },
  });
  expect(shrink.graph.nodes[0]?.size).toEqual({ width: 224, height: 164 });
  expect(shrink.graph.nodes[1]).toEqual(initial.graph.nodes[1]);
});

test('group resizing respects parent bounds and expansion, with keyboard and read-only guards', () => {
  const initial = createEditor({
    nodes: [
      {
        id: 'outer',
        label: 'Outer',
        kind: 'group',
        position: { x: 0, y: 0 },
        size: { width: 400, height: 300 },
        ports: [],
      },
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        position: { x: 40, y: 50 },
        size: { width: 250, height: 150 },
        ports: [],
        parentId: 'outer',
        extent: 'parent',
      },
    ],
    edges: [],
  });
  const bounded = updateEditor(initial, {
    type: 'GroupResizeNudged',
    id: 'g',
    delta: { x: 500, y: 500 },
  });
  expect(bounded.graph.nodes[1]?.size).toEqual({ width: 360, height: 250 });
  expect(bounded.graph.nodes[0]).toEqual(initial.graph.nodes[0]);
  expect(bounded.past).toHaveLength(1);
  const growing = updateEditor(initial, { type: 'NodeExpansionToggled', id: 'g' });
  const grown = updateEditor(growing, {
    type: 'GroupResizeNudged',
    id: 'g',
    delta: { x: 500, y: 500 },
  });
  expect(grown.graph.nodes[1]?.size).toEqual({ width: 750, height: 650 });
  expect(grown.graph.nodes[0]?.size).toEqual({ width: 806, height: 716 });
  expect(updateEditor(grown, { type: 'UndoPressed' }).graph).toEqual(growing.graph);
  for (const state of [
    { ...initial, readOnly: true },
    { ...initial, collapsedGroups: ['g'] },
  ]) {
    expect(updateEditor(state, { type: 'GroupResizeNudged', id: 'g', delta: { x: 5, y: 5 } })).toBe(
      state,
    );
    expect(
      updateEditor(state, {
        type: 'NodeResizeStarted',
        id: 'g',
        pointer: 1,
        point: { x: 0, y: 0 },
      }),
    ).toBe(state);
  }
  expect(updateEditor(initial, { type: 'GroupResizeNudged', id: 'g', delta: { x: 0, y: 0 } })).toBe(
    initial,
  );
});

test('resizing a tight authored group preserves its untouched axis', () => {
  const initial = createEditor({
    nodes: [
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        position: { x: 0, y: 0 },
        size: { width: 300, height: 140 },
        ports: [],
      },
      { ...nodeA, parentId: 'g', position: { x: 50, y: 60 } },
    ],
    edges: [],
  });
  const wider = updateEditor(initial, {
    type: 'GroupResizeNudged',
    id: 'g',
    delta: { x: 5, y: 0 },
  });
  expect(wider.graph.nodes[0]?.size).toEqual({ width: 305, height: 140 });
  expect(wider.graph.nodes[1]).toEqual(initial.graph.nodes[1]);
});

test('per-node width limits clamp pointer and keyboard edits and survive document operations', () => {
  const initial = createEditor({
    nodes: [{ ...nodeA, resizeLimits: { minWidth: 100, maxWidth: 500 } }],
    edges: [],
  });
  const start = updateEditor(initial, {
    type: 'NodeResizeStarted',
    id: 'a',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const large = updateEditor(start, { type: 'PointerMoved', pointer: 1, point: { x: 1000, y: 0 } });
  expect(large.graph.nodes[0]?.size.width).toBe(500);
  const small = updateEditor(start, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: -1000, y: 0 },
  });
  expect(small.graph.nodes[0]?.size.width).toBe(100);
  expect(updateEditor(large, { type: 'GestureCancelled' }).graph).toEqual(initial.graph);
  const keyed = updateEditor(initial, { type: 'NodeWidthChanged', id: 'a', width: 900 });
  expect(keyed.graph.nodes[0]?.size.width).toBe(500);
  expect(updateEditor(keyed, { type: 'NodeWidthChanged', id: 'a', width: 800 })).toBe(keyed);
  expect(updateEditor(keyed, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  expect(parseGraph(serializeGraph(keyed.graph))).toEqual(keyed.graph);
  const duplicated = updateEditor({ ...keyed, selectedNodes: ['a'] }, { type: 'DuplicatePressed' });
  expect(duplicated.graph.nodes[1]?.resizeLimits).toEqual({ minWidth: 100, maxWidth: 500 });
});

test('group resize limits bound both axes and reject a conflict with content or parent bounds', () => {
  const initial = createEditor({
    nodes: [
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        position: { x: 0, y: 0 },
        size: { width: 500, height: 300 },
        ports: [],
        resizeLimits: { minWidth: 260, maxWidth: 600, minHeight: 180, maxHeight: 400 },
      },
      { ...nodeA, parentId: 'g', position: { x: 50, y: 60 } },
    ],
    edges: [],
  });
  const big = updateEditor(initial, {
    type: 'GroupResizeNudged',
    id: 'g',
    delta: { x: 1000, y: 1000 },
  });
  expect(big.graph.nodes[0]?.size).toEqual({ width: 600, height: 400 });
  const small = updateEditor(initial, {
    type: 'GroupResizeNudged',
    id: 'g',
    delta: { x: -1000, y: -1000 },
  });
  expect(small.graph.nodes[0]?.size).toEqual({ width: 260, height: 180 });
  expect(small.graph.nodes[1]).toEqual(initial.graph.nodes[1]);
  const conflicting = createEditor({
    ...initial.graph,
    nodes: initial.graph.nodes.map((node) =>
      node.id === 'g' ? { ...node, resizeLimits: { maxWidth: 150 } } : node,
    ),
  });
  expect(
    updateEditor(conflicting, { type: 'GroupResizeNudged', id: 'g', delta: { x: -1, y: 0 } }),
  ).toBe(conflicting);
  const contained = createEditor({
    nodes: [
      {
        id: 'outer',
        kind: 'group',
        label: 'Outer',
        ports: [],
        position: { x: 0, y: 0 },
        size: { width: 200, height: 200 },
      },
      ...initial.graph.nodes.map((node) =>
        node.id === 'g' ? { ...node, parentId: 'outer', extent: 'parent' as const } : node,
      ),
    ],
    edges: [],
  });
  expect(
    updateEditor(contained, { type: 'GroupResizeNudged', id: 'g', delta: { x: 1, y: 0 } }),
  ).toBe(contained);
  const start = updateEditor(initial, {
    type: 'NodeResizeStarted',
    id: 'g',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const preview = updateEditor(start, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 1000, y: 1000 },
  });
  expect(preview.graph).toEqual(big.graph);
  const committed = updateEditor(preview, { type: 'PointerReleased', pointer: 1 });
  expect(committed.past).toHaveLength(1);
  expect(updateEditor(committed, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
});

test('resize limits reject malformed metadata and accept partial limits outside legacy defaults', () => {
  for (const resizeLimits of [
    null,
    'wide',
    { minWidth: 0 },
    { maxHeight: -2 },
    { minHeight: Infinity },
    { minWidth: 300, maxWidth: 200 },
    { minHeight: 100, maxHeight: 50 },
  ]) {
    expect(() =>
      parseGraph(
        JSON.stringify({ version: 1, graph: { nodes: [{ ...nodeA, resizeLimits }], edges: [] } }),
      ),
    ).toThrow();
  }
  for (const [resizeLimits, requested, expected] of [
    [{ maxWidth: 90 }, 20, 20],
    [{ minWidth: 500 }, 20, 500],
  ] as const) {
    const initial = createEditor({ nodes: [{ ...nodeA, resizeLimits }], edges: [] });
    expect(
      updateEditor(initial, { type: 'NodeWidthChanged', id: 'a', width: requested }).graph.nodes[0]
        ?.size.width,
    ).toBe(expected);
  }
});

test('height continues resizing after width reaches its limit and height-only drags are undoable', () => {
  const initial = createEditor({
    nodes: [
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        ports: [],
        position: { x: 0, y: 0 },
        size: { width: 300, height: 200 },
        resizeLimits: { maxWidth: 320, maxHeight: 400 },
      },
    ],
    edges: [],
  });
  const start = updateEditor(initial, {
    type: 'NodeResizeStarted',
    id: 'g',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const wide = updateEditor(start, { type: 'PointerMoved', pointer: 1, point: { x: 50, y: 20 } });
  const tall = updateEditor(wide, { type: 'PointerMoved', pointer: 1, point: { x: 100, y: 150 } });
  expect(tall.graph.nodes[0]?.size).toEqual({ width: 320, height: 350 });
  const heightOnly = updateEditor(start, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 0, y: 50 },
  });
  expect(heightOnly.graph.nodes[0]?.size).toEqual({ width: 300, height: 250 });
  const released = updateEditor(heightOnly, { type: 'PointerReleased', pointer: 1 });
  expect(released.past).toHaveLength(1);
  expect(updateEditor(released, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
});

test('locked group proportions scale both axes through pointer, keyboard and width edits', () => {
  const initial = createEditor({
    nodes: [
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        ports: [],
        position: { x: 10, y: 20 },
        size: { width: 400, height: 200 },
        keepAspectRatio: true,
        resizeLimits: { maxWidth: 600, maxHeight: 250 },
      },
    ],
    edges: [],
  });
  const start = updateEditor(initial, {
    type: 'NodeResizeStarted',
    id: 'g',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const preview = updateEditor(start, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 200, y: 10 },
  });
  expect(preview.graph.nodes[0]?.size).toEqual({ width: 500, height: 250 });
  expect(preview.graph.nodes[0]?.position).toEqual({ x: 10, y: 20 });
  expect(updateEditor(preview, { type: 'GestureCancelled' }).graph).toEqual(initial.graph);
  const released = updateEditor(preview, { type: 'PointerReleased', pointer: 1 });
  expect(released.past).toHaveLength(1);
  expect(updateEditor(released, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  const keyed = updateEditor(initial, {
    type: 'GroupResizeNudged',
    id: 'g',
    delta: { x: 0, y: 20 },
  });
  expect(keyed.graph.nodes[0]?.size.width).toBeCloseTo(440);
  expect(keyed.graph.nodes[0]?.size.height).toBeCloseTo(220);
  const width = updateEditor(initial, { type: 'NodeWidthChanged', id: 'g', width: 480 });
  expect(width.graph.nodes[0]?.size).toEqual({ width: 480, height: 240 });
  expect(
    updateEditor(width, { type: 'GroupResizeNudged', id: 'g', delta: { x: -1000, y: 0 } }).graph
      .nodes[0]?.size,
  ).toEqual({ width: 224, height: 112 });
});

test('proportional resizing respects contents, parent bounds and enabled parent expansion', () => {
  const initial = createEditor({
    nodes: [
      {
        id: 'outer',
        label: 'Outer',
        kind: 'group',
        ports: [],
        position: { x: 0, y: 0 },
        size: { width: 500, height: 260 },
      },
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        ports: [],
        position: { x: 20, y: 30 },
        size: { width: 400, height: 200 },
        parentId: 'outer',
        extent: 'parent',
        keepAspectRatio: true,
      },
      { ...nodeA, parentId: 'g', position: { x: 50, y: 70 } },
    ],
    edges: [],
  });
  const bounded = updateEditor(initial, {
    type: 'GroupResizeNudged',
    id: 'g',
    delta: { x: 500, y: 0 },
  });
  expect(bounded.graph.nodes[1]?.size.width).toBeCloseTo(460, 10);
  expect(bounded.graph.nodes[1]?.size.height).toBeCloseTo(230, 10);
  expect(
    updateEditor(bounded, { type: 'GroupResizeNudged', id: 'g', delta: { x: 500, y: 0 } }),
  ).toBe(bounded);
  expect(bounded.graph.nodes[2]).toEqual(initial.graph.nodes[2]);
  const shrink = updateEditor(initial, {
    type: 'GroupResizeNudged',
    id: 'g',
    delta: { x: -1000, y: 0 },
  });
  expect(shrink.graph.nodes[1]?.size).toEqual({ width: 288, height: 144 });
  const expanding = updateEditor(initial, { type: 'NodeExpansionToggled', id: 'g' });
  const grown = updateEditor(expanding, {
    type: 'GroupResizeNudged',
    id: 'g',
    delta: { x: 200, y: 0 },
  });
  expect(grown.graph.nodes[1]?.size).toEqual({ width: 600, height: 300 });
  expect(grown.graph.nodes[0]?.size).toEqual({ width: 636, height: 346 });
  const conflicting = createEditor({
    ...initial.graph,
    nodes: initial.graph.nodes.map((node) =>
      node.id === 'g' ? { ...node, resizeLimits: { minWidth: 500, maxHeight: 200 } } : node,
    ),
  });
  expect(
    updateEditor(conflicting, { type: 'GroupResizeNudged', id: 'g', delta: { x: 5, y: 0 } }),
  ).toBe(conflicting);
});

test('proportion lock is validated group metadata, persisted and undoable', () => {
  const initial = createEditor({
    nodes: [
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        ports: [],
        position: { x: 0, y: 0 },
        size: { width: 400, height: 200 },
      },
    ],
    edges: [],
  });
  const locked = updateEditor(initial, { type: 'GroupAspectRatioToggled', id: 'g' });
  expect(locked.graph.nodes[0]?.keepAspectRatio).toBe(true);
  expect(locked.graph.nodes[0]?.size).toEqual(initial.graph.nodes[0]?.size);
  expect(parseGraph(serializeGraph(locked.graph))).toEqual(locked.graph);
  expect(updateEditor(locked, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  const unlocked = updateEditor(locked, { type: 'GroupAspectRatioToggled', id: 'g' });
  expect(unlocked.graph.nodes[0]?.keepAspectRatio).toBe(false);
  const duplicated = updateEditor(
    { ...locked, selectedNodes: ['g'] },
    { type: 'DuplicatePressed' },
  );
  expect(duplicated.graph.nodes[1]?.keepAspectRatio).toBe(true);
  expect(
    updateEditor({ ...initial, readOnly: true }, { type: 'GroupAspectRatioToggled', id: 'g' })
      .graph,
  ).toEqual(initial.graph);
  for (const node of [
    { ...nodeA, keepAspectRatio: true },
    { ...initial.graph.nodes[0], keepAspectRatio: 'yes' },
  ]) {
    expect(() =>
      parseGraph(JSON.stringify({ version: 1, graph: { nodes: [node], edges: [] } })),
    ).toThrow();
  }
});

test('all group corners keep the opposite corner anchored and contents fixed at zoom', () => {
  const initial = createEditor(
    {
      nodes: [
        {
          id: 'g',
          label: 'Group',
          kind: 'group',
          ports: [],
          position: { x: 100, y: 100 },
          size: { width: 400, height: 300 },
        },
        { ...nodeA, parentId: 'g', position: { x: 200, y: 200 } },
      ],
      edges: [],
    },
    { viewport: { x: 0, y: 0, zoom: 2 } },
  );
  for (const [corner, point, position] of [
    ['top-left', { x: -80, y: -40 }, { x: 60, y: 80 }],
    ['top-right', { x: 80, y: -40 }, { x: 100, y: 80 }],
    ['bottom-left', { x: -80, y: 40 }, { x: 60, y: 100 }],
    ['bottom-right', { x: 80, y: 40 }, { x: 100, y: 100 }],
  ] as const) {
    const start = updateEditor(initial, {
      type: 'NodeResizeStarted',
      id: 'g',
      pointer: 1,
      point: { x: 0, y: 0 },
      corner,
    });
    const preview = updateEditor(start, { type: 'PointerMoved', pointer: 1, point });
    expect(preview.graph.nodes[0]?.position).toEqual(position);
    expect(preview.graph.nodes[0]?.size).toEqual({ width: 440, height: 320 });
    expect(preview.graph.nodes[1]).toEqual(initial.graph.nodes[1]);
    expect(updateEditor(preview, { type: 'GestureCancelled' }).graph).toEqual(initial.graph);
    const committed = updateEditor(preview, { type: 'PointerReleased', pointer: 1 });
    expect(committed.past).toHaveLength(1);
    expect(updateEditor(committed, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  }
});

test('top-left resize stops at contents, intersects parent bounds, and can expand ancestors', () => {
  const initial = createEditor({
    nodes: [
      {
        id: 'outer',
        label: 'Outer',
        kind: 'group',
        ports: [],
        position: { x: 50, y: 50 },
        size: { width: 550, height: 450 },
      },
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        ports: [],
        position: { x: 100, y: 100 },
        size: { width: 400, height: 300 },
        parentId: 'outer',
        extent: 'parent',
      },
      { ...nodeA, parentId: 'g', position: { x: 200, y: 200 } },
    ],
    edges: [],
  });
  const bounded = updateEditor(initial, {
    type: 'GroupResizeNudged',
    id: 'g',
    corner: 'top-left',
    delta: { x: -1000, y: -1000 },
  });
  expect(bounded.graph.nodes[1]?.position).toEqual({ x: 50, y: 50 });
  expect(bounded.graph.nodes[1]?.size).toEqual({ width: 450, height: 350 });
  const shrink = updateEditor(initial, {
    type: 'GroupResizeNudged',
    id: 'g',
    corner: 'top-left',
    delta: { x: 1000, y: 1000 },
  });
  expect(shrink.graph.nodes[1]?.position).toEqual({ x: 176, y: 152 });
  expect(shrink.graph.nodes[1]?.size).toEqual({ width: 324, height: 248 });
  expect(shrink.graph.nodes[2]).toEqual(initial.graph.nodes[2]);
  const expanding = updateEditor(initial, { type: 'NodeExpansionToggled', id: 'g' });
  const grown = updateEditor(expanding, {
    type: 'GroupResizeNudged',
    id: 'g',
    corner: 'top-left',
    delta: { x: -100, y: -100 },
  });
  expect(grown.graph.nodes[1]?.position).toEqual({ x: 0, y: 0 });
  expect(grown.graph.nodes[0]?.position).toEqual({ x: -16, y: -16 });
  expect(grown.graph.nodes[2]).toEqual(initial.graph.nodes[2]);
  expect(updateEditor(grown, { type: 'UndoPressed' }).graph).toEqual(expanding.graph);
});

test('locked top-left resizing respects size limits without moving the bottom-right anchor', () => {
  const initial = createEditor({
    nodes: [
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        ports: [],
        position: { x: 100, y: 100 },
        size: { width: 400, height: 200 },
        keepAspectRatio: true,
        resizeLimits: { maxWidth: 500, maxHeight: 300 },
      },
    ],
    edges: [],
  });
  const resized = updateEditor(initial, {
    type: 'GroupResizeNudged',
    id: 'g',
    corner: 'top-left',
    delta: { x: -200, y: -10 },
  });
  expect(resized.graph.nodes[0]?.position).toEqual({ x: 0, y: 50 });
  expect(resized.graph.nodes[0]?.size).toEqual({ width: 500, height: 250 });
  expect(
    updateEditor(resized, {
      type: 'GroupResizeNudged',
      id: 'g',
      corner: 'top-left',
      delta: { x: -20, y: 0 },
    }),
  ).toBe(resized);
});

test('side handles change only their axis at zoom and anchor the opposite edge', () => {
  const initial = createEditor(
    {
      nodes: [
        {
          id: 'g',
          label: 'Group',
          kind: 'group',
          ports: [],
          position: { x: 100, y: 100 },
          size: { width: 400, height: 300 },
        },
        { ...nodeA, parentId: 'g', position: { x: 200, y: 200 } },
      ],
      edges: [],
    },
    { viewport: { x: 0, y: 0, zoom: 2 } },
  );
  for (const [handle, point, position, size] of [
    ['left', { x: -80, y: 90 }, { x: 60, y: 100 }, { width: 440, height: 300 }],
    ['right', { x: 80, y: 90 }, { x: 100, y: 100 }, { width: 440, height: 300 }],
    ['top', { x: 90, y: -40 }, { x: 100, y: 80 }, { width: 400, height: 320 }],
    ['bottom', { x: 90, y: 40 }, { x: 100, y: 100 }, { width: 400, height: 320 }],
  ] as const) {
    const start = updateEditor(initial, {
      type: 'NodeResizeStarted',
      id: 'g',
      pointer: 1,
      point: { x: 0, y: 0 },
      handle,
    });
    const preview = updateEditor(start, { type: 'PointerMoved', pointer: 1, point });
    expect(preview.graph.nodes[0]?.position).toEqual(position);
    expect(preview.graph.nodes[0]?.size).toEqual(size);
    expect(preview.graph.nodes[1]).toEqual(initial.graph.nodes[1]);
    expect(updateEditor(preview, { type: 'GestureCancelled' }).graph).toEqual(initial.graph);
    const released = updateEditor(preview, { type: 'PointerReleased', pointer: 1 });
    expect(released.past).toHaveLength(1);
    expect(updateEditor(released, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  }
});

test('locked side handles preserve the perpendicular center and intersect parent bounds', () => {
  const initial = createEditor({
    nodes: [
      {
        id: 'outer',
        label: 'Outer',
        kind: 'group',
        ports: [],
        position: { x: 0, y: 0 },
        size: { width: 600, height: 400 },
      },
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        ports: [],
        position: { x: 100, y: 100 },
        size: { width: 400, height: 200 },
        parentId: 'outer',
        extent: 'parent',
        keepAspectRatio: true,
      },
    ],
    edges: [],
  });
  const right = updateEditor(initial, {
    type: 'GroupResizeNudged',
    id: 'g',
    handle: 'right',
    delta: { x: 1000, y: 999 },
  });
  expect(right.graph.nodes[1]?.size).toEqual({ width: 500, height: 250 });
  expect(right.graph.nodes[1]?.position).toEqual({ x: 100, y: 75 });
  const top = updateEditor(initial, {
    type: 'GroupResizeNudged',
    id: 'g',
    handle: 'top',
    delta: { x: 999, y: -1000 },
  });
  expect(top.graph.nodes[1]?.size).toEqual({ width: 600, height: 300 });
  expect(top.graph.nodes[1]?.position).toEqual({ x: 0, y: 0 });
  expect(
    updateEditor(right, {
      type: 'GroupResizeNudged',
      id: 'g',
      handle: 'right',
      delta: { x: 5, y: 0 },
    }),
  ).toBe(right);
  expect(
    updateEditor(initial, {
      type: 'GroupResizeNudged',
      id: 'g',
      handle: 'right',
      delta: { x: 0, y: 20 },
    }),
  ).toBe(initial);
});

test('side resizing protects centered contents, honors limits and expands parents atomically', () => {
  const initial = createEditor({
    nodes: [
      {
        id: 'outer',
        label: 'Outer',
        kind: 'group',
        ports: [],
        position: { x: 50, y: 50 },
        size: { width: 500, height: 300 },
      },
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        ports: [],
        position: { x: 100, y: 100 },
        size: { width: 400, height: 200 },
        parentId: 'outer',
        expandParent: true,
        keepAspectRatio: true,
        resizeLimits: { maxWidth: 600 },
      },
      { ...nodeA, parentId: 'g', position: { x: 200, y: 160 } },
    ],
    edges: [],
  });
  const small = updateEditor(initial, {
    type: 'GroupResizeNudged',
    id: 'g',
    handle: 'left',
    delta: { x: 1000, y: 0 },
  });
  // The 48-unit header above y=160 requires top <= 112: height >= 176 at center y=200.
  expect(small.graph.nodes[1]?.size).toEqual({ width: 352, height: 176 });
  expect(small.graph.nodes[1]?.position).toEqual({ x: 148, y: 112 });
  expect(small.graph.nodes[2]).toEqual(initial.graph.nodes[2]);
  const large = updateEditor(initial, {
    type: 'GroupResizeNudged',
    id: 'g',
    handle: 'left',
    delta: { x: -1000, y: 0 },
  });
  expect(large.graph.nodes[1]?.size).toEqual({ width: 600, height: 300 });
  expect(large.graph.nodes[1]?.position).toEqual({ x: -100, y: 50 });
  expect(large.graph.nodes[0]?.position).toEqual({ x: -116, y: 50 });
  expect(large.past).toHaveLength(1);
  expect(updateEditor(large, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
});

test('resize snapping targets moving edges in canvas coordinates at zoom', () => {
  const initial = createEditor(
    {
      nodes: [
        {
          id: 'g',
          label: 'Group',
          kind: 'group',
          ports: [],
          position: { x: 103, y: 107 },
          size: { width: 402, height: 302 },
        },
      ],
      edges: [],
    },
    { snapToGrid: true, viewport: { x: 30, y: 40, zoom: 2 } },
  );
  const start = updateEditor(initial, {
    type: 'NodeResizeStarted',
    id: 'g',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const preview = updateEditor(start, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 14, y: 16 },
  });
  expect(preview.graph.nodes[0]?.position).toEqual({ x: 103, y: 107 });
  expect(preview.graph.nodes[0]?.size).toEqual({ width: 417, height: 313 });
  const released = updateEditor(preview, { type: 'PointerReleased', pointer: 1 });
  expect(released.past).toHaveLength(1);
  expect(updateEditor(released, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  expect(updateEditor(preview, { type: 'GestureCancelled' }).graph).toEqual(initial.graph);
  const left = updateEditor(initial, {
    type: 'GroupResizeNudged',
    id: 'g',
    handle: 'top-left',
    delta: { x: 7, y: 8 },
  });
  expect(left.graph.nodes[0]?.position).toEqual({ x: 120, y: 120 });
  expect(left.graph.nodes[0]?.size).toEqual({ width: 385, height: 289 });
  const side = updateEditor(initial, {
    type: 'GroupResizeNudged',
    id: 'g',
    handle: 'right',
    delta: { x: 7, y: 999 },
  });
  expect(side.graph.nodes[0]?.size).toEqual({ width: 417, height: 302 });
  expect(
    updateEditor(initial, { type: 'NodeWidthChanged', id: 'g', width: 411 }).graph.nodes[0]?.size
      .width,
  ).toBe(417);
});

test('resize limits and locked proportions take precedence over the snap grid', () => {
  const initial = createEditor(
    {
      nodes: [
        {
          id: 'g',
          label: 'Group',
          kind: 'group',
          ports: [],
          position: { x: 100, y: 100 },
          size: { width: 400, height: 200 },
          keepAspectRatio: true,
        },
      ],
      edges: [],
    },
    { snapToGrid: true },
  );
  const right = updateEditor(initial, {
    type: 'GroupResizeNudged',
    id: 'g',
    handle: 'right',
    delta: { x: 13, y: 0 },
  });
  expect(right.graph.nodes[0]?.size).toEqual({ width: 420, height: 210 });
  expect(right.graph.nodes[0]?.position).toEqual({ x: 100, y: 95 });
  const limited = createEditor(
    {
      nodes: [
        {
          ...initial.graph.nodes[0],
          id: 'g',
          label: 'Group',
          ports: [],
          position: { x: 100, y: 100 },
          size: { width: 400, height: 200 },
          resizeLimits: { maxHeight: 205 },
        },
      ],
      edges: [],
    },
    { snapToGrid: true },
  );
  const capped = updateEditor(limited, {
    type: 'GroupResizeNudged',
    id: 'g',
    handle: 'right',
    delta: { x: 100, y: 0 },
  });
  expect(capped.graph.nodes[0]?.size.width).toBeCloseTo(410, 10);
  expect(capped.graph.nodes[0]?.size.height).toBeCloseTo(205, 10);
  const start = updateEditor(initial, {
    type: 'NodeResizeStarted',
    id: 'g',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const unchanged = updateEditor(start, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 3, y: 0 },
  });
  expect(unchanged.graph).toEqual(initial.graph);
  expect(updateEditor(unchanged, { type: 'PointerReleased', pointer: 1 }).past).toHaveLength(0);
});

test('configured grid spacing drives node dragging, group resizing and survives Undo', () => {
  const initial = createEditor(
    {
      nodes: [
        {
          id: 'g',
          label: 'Group',
          kind: 'group',
          ports: [],
          position: { x: 103, y: 107 },
          size: { width: 402, height: 302 },
        },
      ],
      edges: [],
    },
    { snapToGrid: true, gridSpacing: 32 },
  );
  expect(initial.gridSpacing).toBe(32);
  const start = updateEditor(initial, {
    type: 'NodeResizeStarted',
    id: 'g',
    pointer: 1,
    point: { x: 0, y: 0 },
    handle: 'right',
  });
  const resized = updateEditor(start, { type: 'PointerMoved', pointer: 1, point: { x: 20, y: 0 } });
  expect(resized.graph.nodes[0]?.size).toEqual({ width: 409, height: 302 });
  const released = updateEditor(resized, { type: 'PointerReleased', pointer: 1 });
  const changed = updateEditor(released, { type: 'GridSpacingChanged', spacing: 50 });
  expect(changed.graph).toBe(released.graph);
  expect(changed.revision).toBe(released.revision);
  expect(changed.past).toBe(released.past);
  const undone = updateEditor(changed, { type: 'UndoPressed' });
  expect(undone.graph).toEqual(initial.graph);
  expect(undone.gridSpacing).toBe(50);
  const drag = updateEditor(undone, {
    type: 'NodeDragStarted',
    id: 'g',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const moved = updateEditor(drag, { type: 'PointerMoved', pointer: 1, point: { x: 20, y: 20 } });
  expect(moved.graph.nodes[0]?.position).toEqual({ x: 100, y: 150 });
  expect(updateEditor(moved, { type: 'GridSpacingChanged', spacing: 10 })).toBe(moved);
});

test('grid spacing validates initialization and preference changes without creating history', () => {
  const initial = createEditor(graph);
  expect(initial.gridSpacing).toBe(20);
  for (const spacing of [0, -1, NaN, Infinity]) {
    expect(() => createEditor(graph, { gridSpacing: spacing })).toThrow('Grid spacing');
    expect(updateEditor(initial, { type: 'GridSpacingChanged', spacing })).toBe(initial);
  }
  const changed = updateEditor(initial, { type: 'GridSpacingChanged', spacing: 12.5 });
  expect(changed.gridSpacing).toBe(12.5);
  expect(changed.graph).toBe(initial.graph);
  expect(changed.past).toHaveLength(0);
  expect(changed.future).toBe(initial.future);
  expect(updateEditor(changed, { type: 'GridSpacingChanged', spacing: 12.5 })).toBe(changed);
  const readOnly = { ...initial, readOnly: true };
  expect(updateEditor(readOnly, { type: 'GridSpacingChanged', spacing: 40 })).toBe(readOnly);
  const start = updateEditor(
    createEditor(
      { nodes: [{ ...nodeA, position: { x: 10, y: 10 } }], edges: [] },
      { snapToGrid: true, gridSpacing: 12.5 },
    ),
    { type: 'NodeDragStarted', id: 'a', pointer: 1, point: { x: 0, y: 0 } },
  );
  expect(
    updateEditor(start, { type: 'PointerMoved', pointer: 1, point: { x: 4, y: 4 } }).graph.nodes[0]
      ?.position,
  ).toEqual({ x: 12.5, y: 12.5 });
});

test('group resize alignment overrides grid on a matched edge with screen-space tolerance', () => {
  const fixture: FlowGraph = {
    nodes: [
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        ports: [],
        position: { x: 100, y: 100 },
        size: { width: 400, height: 200 },
      },
      { ...nodeA, id: 'neighbor', position: { x: 603, y: 150 } },
    ],
    edges: [],
  };
  for (const [zoom, aligned] of [
    [2, true],
    [4, false],
  ] as const) {
    const initial = createEditor(fixture, {
      snapToGrid: true,
      snapToAlignment: true,
      viewport: { x: 0, y: 0, zoom },
    });
    const start = updateEditor(initial, {
      type: 'NodeResizeStarted',
      id: 'g',
      handle: 'right',
      pointer: 1,
      point: { x: 0, y: 0 },
    });
    const preview = updateEditor(start, {
      type: 'PointerMoved',
      pointer: 1,
      point: { x: 101 * zoom, y: 0 },
    });
    expect(preview.graph.nodes[0]?.size.width).toBe(aligned ? 503 : 500);
    expect(preview.gesture).toMatchObject({
      type: 'node-resize',
      guides: aligned ? [{ axis: 'x', position: 603, from: 100, to: 300 }] : [],
    });
    expect(preview.graph.nodes[1]).toEqual(initial.graph.nodes[1]);
    expect(updateEditor(preview, { type: 'GestureCancelled' }).graph).toEqual(initial.graph);
    const released = updateEditor(preview, { type: 'PointerReleased', pointer: 1 });
    expect(released.gesture.type).toBe('idle');
    expect(released.past).toHaveLength(1);
    expect(updateEditor(released, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  }
});

test('resize alignment respects locked proportions and suppresses impossible or stale guides', () => {
  const fixture: FlowGraph = {
    nodes: [
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        ports: [],
        position: { x: 100, y: 100 },
        size: { width: 400, height: 200 },
        keepAspectRatio: true,
      },
      { ...nodeA, id: 'neighbor', position: { x: 603, y: 360 } },
    ],
    edges: [],
  };
  const initial = createEditor(fixture, { snapToGrid: true, snapToAlignment: true });
  const start = updateEditor(initial, {
    type: 'NodeResizeStarted',
    id: 'g',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const preview = updateEditor(start, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 101, y: 58 },
  });
  expect(preview.graph.nodes[0]?.size.width).toBeCloseTo(503, 10);
  expect(preview.graph.nodes[0]?.size.height).toBeCloseTo(251.5, 10);
  expect(preview.gesture).toMatchObject({
    type: 'node-resize',
    guides: [{ axis: 'x', position: 603, from: 100, to: 440 }],
  });
  const limited = createEditor(
    {
      ...fixture,
      nodes: fixture.nodes.map((node) =>
        node.id === 'g'
          ? { ...node, keepAspectRatio: false, resizeLimits: { maxWidth: 503 } }
          : { ...node, position: { x: 603, y: 150 } },
      ),
    },
    { snapToGrid: true, snapToAlignment: true },
  );
  const limitStart = updateEditor(limited, {
    type: 'NodeResizeStarted',
    id: 'g',
    handle: 'right',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const atLimit = updateEditor(limitStart, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 101, y: 0 },
  });
  expect(atLimit.gesture).toMatchObject({
    guides: [{ axis: 'x', position: 603, from: 100, to: 300 }],
  });
  const away = updateEditor(atLimit, { type: 'PointerMoved', pointer: 1, point: { x: 130, y: 0 } });
  expect(away.graph).toEqual(atLimit.graph);
  expect(away.revision).toBe(atLimit.revision);
  expect(away.gesture).toMatchObject({ guides: [] });
  const blocked = createEditor(
    {
      ...limited.graph,
      nodes: limited.graph.nodes.map((node) =>
        node.id === 'g' ? { ...node, resizeLimits: { maxWidth: 502 } } : node,
      ),
    },
    { snapToAlignment: true },
  );
  const blockedStart = updateEditor(blocked, {
    type: 'NodeResizeStarted',
    id: 'g',
    handle: 'right',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const blockedPreview = updateEditor(blockedStart, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 101, y: 0 },
  });
  expect(blockedPreview.graph.nodes[0]?.size.width).toBe(502);
  expect(blockedPreview.gesture).toMatchObject({ guides: [] });
});

test('resize alignment ignores hidden nodes and remains opt-in', () => {
  const fixture: FlowGraph = {
    nodes: [
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        ports: [],
        position: { x: 100, y: 100 },
        size: { width: 400, height: 200 },
      },
      {
        id: 'h',
        label: 'Hidden',
        kind: 'group',
        ports: [],
        position: { x: 550, y: 0 },
        size: { width: 500, height: 400 },
      },
      { ...nodeA, id: 'neighbor', parentId: 'h', position: { x: 603, y: 150 } },
    ],
    edges: [],
  };
  for (const options of [
    { snapToAlignment: false, collapsedGroups: [] },
    { snapToAlignment: true, collapsedGroups: ['h'] },
  ]) {
    const initial = {
      ...createEditor(fixture, { snapToGrid: true, snapToAlignment: options.snapToAlignment }),
      collapsedGroups: options.collapsedGroups,
    };
    const start = updateEditor(initial, {
      type: 'NodeResizeStarted',
      id: 'g',
      handle: 'right',
      pointer: 1,
      point: { x: 0, y: 0 },
    });
    const preview = updateEditor(start, {
      type: 'PointerMoved',
      pointer: 1,
      point: { x: 101, y: 0 },
    });
    expect(preview.graph.nodes[0]?.size.width).toBe(500);
    expect(preview.gesture).toMatchObject({ guides: [] });
  }
});

test('top and left resize handles align only their moving edges and preserve opposite anchors', () => {
  const initial = createEditor(
    {
      nodes: [
        {
          id: 'g',
          label: 'Group',
          kind: 'group',
          ports: [],
          position: { x: 100, y: 100 },
          size: { width: 400, height: 300 },
        },
        { ...nodeA, id: 'neighbor', position: { x: 50, y: 50 }, size: { width: 80, height: 80 } },
      ],
      edges: [],
    },
    { snapToAlignment: true, snapToGrid: true },
  );
  for (const [handle, point, position, size, guides] of [
    [
      'top-left',
      { x: 32, y: 32 },
      { x: 130, y: 130 },
      { width: 370, height: 270 },
      [
        { axis: 'x', position: 130, from: 50, to: 400 },
        { axis: 'y', position: 130, from: 50, to: 500 },
      ],
    ],
    [
      'left',
      { x: 32, y: 999 },
      { x: 130, y: 100 },
      { width: 370, height: 300 },
      [{ axis: 'x', position: 130, from: 50, to: 400 }],
    ],
    [
      'top',
      { x: 999, y: 32 },
      { x: 100, y: 130 },
      { width: 400, height: 270 },
      [{ axis: 'y', position: 130, from: 50, to: 500 }],
    ],
  ] as const) {
    const start = updateEditor(initial, {
      type: 'NodeResizeStarted',
      id: 'g',
      pointer: 1,
      point: { x: 0, y: 0 },
      handle,
    });
    const preview = updateEditor(start, { type: 'PointerMoved', pointer: 1, point });
    expect(preview.graph.nodes[0]?.position).toEqual(position);
    expect(preview.graph.nodes[0]?.size).toEqual(size);
    expect(preview.gesture).toMatchObject({ type: 'node-resize', guides });
  }
});

test('numeric group dimensions apply limits without moving children and keep the matching panel open', () => {
  const initial = createEditor({
    nodes: [
      {
        id: 'outer',
        label: 'Outer',
        kind: 'group',
        ports: [],
        position: { x: 0, y: 0 },
        size: { width: 600, height: 450 },
      },
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        ports: [],
        position: { x: 40, y: 50 },
        size: { width: 300, height: 200 },
        parentId: 'outer',
        extent: 'parent',
        resizeLimits: { minWidth: 260, maxWidth: 500, minHeight: 160, maxHeight: 360 },
      },
      { ...nodeA, parentId: 'g', position: { x: 80, y: 120 } },
    ],
    edges: [],
  });
  const opened = updateEditor(initial, {
    type: 'ContextOpened',
    context: { kind: 'node', id: 'g', point: { x: 10, y: 10 } },
  });
  const wide = updateEditor(opened, {
    type: 'GroupDimensionChanged',
    id: 'g',
    dimension: 'width',
    value: 800,
  });
  expect(wide.graph.nodes[1]?.size).toEqual({ width: 500, height: 200 });
  expect(wide.graph.nodes[1]?.position).toEqual({ x: 40, y: 50 });
  expect(wide.graph.nodes[2]).toEqual(initial.graph.nodes[2]);
  expect(wide.context).toEqual(opened.context);
  const tall = updateEditor(wide, {
    type: 'GroupDimensionChanged',
    id: 'g',
    dimension: 'height',
    value: 500,
  });
  expect(tall.graph.nodes[1]?.size).toEqual({ width: 500, height: 360 });
  expect(tall.context).toEqual(opened.context);
  expect(tall.past).toHaveLength(2);
  const undoHeight = updateEditor(tall, { type: 'UndoPressed' });
  expect(undoHeight.graph).toEqual(wide.graph);
  expect(updateEditor(undoHeight, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  for (const value of [0, -1, NaN, Infinity])
    expect(
      updateEditor(opened, { type: 'GroupDimensionChanged', id: 'g', dimension: 'height', value }),
    ).toBe(opened);
  expect(
    updateEditor(wide, { type: 'GroupDimensionChanged', id: 'g', dimension: 'width', value: 800 }),
  ).toBe(wide);
  for (const state of [
    { ...opened, readOnly: true },
    { ...opened, collapsedGroups: ['g'] },
  ])
    expect(
      updateEditor(state, {
        type: 'GroupDimensionChanged',
        id: 'g',
        dimension: 'height',
        value: 250,
      }),
    ).toBe(state);
  expect(
    updateEditor(opened, {
      type: 'GroupDimensionChanged',
      id: 'a',
      dimension: 'height',
      value: 250,
    }),
  ).toBe(opened);
});

test('numeric dimensions share ratio locking, grid snapping and atomic parent expansion', () => {
  const fixture: FlowGraph = {
    nodes: [
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        ports: [],
        position: { x: 100, y: 100 },
        size: { width: 400, height: 200 },
        keepAspectRatio: true,
        resizeLimits: { maxWidth: 600, maxHeight: 280 },
      },
    ],
    edges: [],
  };
  const initial = createEditor(fixture);
  const tall = updateEditor(initial, {
    type: 'GroupDimensionChanged',
    id: 'g',
    dimension: 'height',
    value: 260,
  });
  expect(tall.graph.nodes[0]?.size).toEqual({ width: 520, height: 260 });
  const capped = updateEditor(initial, {
    type: 'GroupDimensionChanged',
    id: 'g',
    dimension: 'width',
    value: 800,
  });
  expect(capped.graph.nodes[0]?.size.width).toBeCloseTo(560, 10);
  expect(capped.graph.nodes[0]?.size.height).toBeCloseTo(280, 10);
  const snapped = createEditor(fixture, { snapToGrid: true, gridSpacing: 32 });
  const wide = updateEditor(snapped, {
    type: 'GroupDimensionChanged',
    id: 'g',
    dimension: 'width',
    value: 450,
  });
  expect(wide.graph.nodes[0]?.size.width).toBeCloseTo(444, 10);
  expect(wide.graph.nodes[0]?.size.height).toBeCloseTo(222, 10);
  expect(updateEditor(snapped, { type: 'NodeWidthChanged', id: 'g', width: 450 }).graph).toEqual(
    wide.graph,
  );
  const parent = createEditor({
    nodes: [
      {
        id: 'outer',
        label: 'Outer',
        kind: 'group',
        ports: [],
        position: { x: 0, y: 0 },
        size: { width: 400, height: 300 },
      },
      {
        id: 'g',
        label: 'Group',
        kind: 'group',
        ports: [],
        parentId: 'outer',
        extent: 'parent',
        expandParent: true,
        position: { x: 40, y: 50 },
        size: { width: 300, height: 200 },
      },
    ],
    edges: [],
  });
  const grown = updateEditor(parent, {
    type: 'GroupDimensionChanged',
    id: 'g',
    dimension: 'height',
    value: 400,
  });
  expect(grown.graph.nodes[0]?.size.height).toBe(466);
  expect(grown.graph.nodes[1]?.size.height).toBe(400);
  expect(grown.past).toHaveLength(1);
  expect(updateEditor(grown, { type: 'UndoPressed' }).graph).toEqual(parent.graph);
});

test('snapshots restore a camera and accept graph-only v1 documents', () => {
  const legacy = '{"version":1,"graph":{"nodes":[],"edges":[]}}';
  const stored =
    '{"version":1,"graph":{"nodes":[],"edges":[]},"viewport":{"x":-83,"y":107,"zoom":1.75}}';
  const empty = { nodes: [], edges: [] };
  const viewport = { x: -83, y: 107, zoom: 1.75 };
  expect(parseSnapshot(legacy)).toEqual({ graph: empty });
  expect(parseSnapshot(stored)).toEqual({ graph: empty, viewport });
  expect(parseGraph(stored)).toEqual(empty);

  const editor = updateEditor(createEditor(graph), { type: 'ViewportChanged', viewport });
  expect(JSON.parse(serializeSnapshot(editor))).toEqual({ version: 1, graph, viewport });
  expect(parseSnapshot(serializeSnapshot(editor))).toEqual({ graph, viewport });
  expect(serializeSnapshot({ graph })).toBe(serializeGraph(graph));

  for (const invalid of [
    'null',
    '{}',
    '{"x":0,"y":0,"zoom":0}',
    '{"x":1e999,"y":0,"zoom":1}',
    '{"x":0,"y":0,"zoom":"1"}',
  ]) {
    expect(() => parseSnapshot(legacy.slice(0, -1) + ',"viewport":' + invalid + '}')).toThrow();
  }
  expect(() => parseSnapshot(stored.replace('"version":1', '"version":2'))).toThrow();
  expect(() => serializeSnapshot({ graph, viewport: { ...viewport, y: Infinity } })).toThrow();
});

test('revealing a node opens its ancestors and centers it without editing the graph', () => {
  const group = {
    id: 'outer',
    label: 'Outer',
    kind: 'group' as const,
    position: { x: 0, y: 0 },
    size: { width: 600, height: 240 },
    ports: [],
  };
  const initial = createEditor({
    nodes: [
      group,
      { ...group, id: 'inner', parentId: group.id },
      nodeA,
      { ...nodeB, parentId: 'inner' },
    ],
    edges: [],
  });
  const state = {
    ...initial,
    surface: { width: 800, height: 440 },
    collapsedGroups: ['outer', 'inner'],
    selectedNodes: ['a'],
    readOnly: true,
  };
  const reveal = { type: 'NodeRevealRequested', id: 'b' } as const;
  const revealed = updateEditor(state, reveal);
  expect(revealed.viewport).toEqual({ x: 20, y: 110, zoom: 1 });
  expect(revealed.collapsedGroups).toEqual([]);
  expect(revealed.graph).toBe(initial.graph);
  expect(revealed.revision).toBe(initial.revision);
  expect(revealed.past).toBe(initial.past);
  expect(revealed.selectedNodes).toBe(state.selectedNodes);

  const zoomed = { ...state, viewport: { x: 0, y: 0, zoom: 4 } };
  expect(updateEditor(zoomed, reveal).viewport.zoom).toBeCloseTo(3.92);
  const hidden = updateEditor(state, {
    type: 'VisibilityChanged',
    visibility: { hiddenNodeIds: ['outer'] },
  });
  expect(updateEditor(hidden, reveal)).toBe(hidden);
  expect(updateEditor(state, { ...reveal, id: 'unknown' })).toBe(state);

  const animated = updateEditor({ ...state, fitViewDuration: 200 }, reveal);
  expect(animated.fitViewTransition.type).toBe('fitting');
  expect(
    updateEditor(animated, {
      type: 'FitViewAnimationFrame',
      id: animated.fitViewTransition.id,
      time: 0,
      reducedMotion: true,
    }).viewport,
  ).toEqual(revealed.viewport);
});
