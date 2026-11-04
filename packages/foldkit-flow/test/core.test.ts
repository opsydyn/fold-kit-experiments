import { describe, expect, test } from 'bun:test';

import fc from 'fast-check';

import { minimapGeometry } from '../src/geometry';
import {
  applyLayout,
  createEditor,
  fitViewport,
  layoutRequest,
  parseGraph,
  portPosition,
  serializeGraph,
  screenToWorld,
  updateEditor,
  zoomAt,
  type FlowGraph,
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
