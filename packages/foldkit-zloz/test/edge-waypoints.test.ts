import { expect, test } from 'bun:test';

import { presentVisibleGraph } from '../src/group-presentation';
import {
  applyLayout,
  captureEdition,
  compareEditions,
  createEditor,
  edgePath,
  fitViewport,
  insertPattern,
  layoutRequest,
  minimapGeometry,
  parseGraph,
  parseModelDocument,
  resolveConnectionPreview,
  resolveEdgeGeometry,
  resolveEdgeWaypointEdit,
  serializeGraph,
  serializeModelDocument,
  updateEditor,
} from '../src/index';
import { minimapContext } from '../src/navigation';
import { viewportItems } from '../src/viewport-culling';
import fixture from './fixtures/waypoints-v1.json';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Fixture value is required');
  return value;
}

const graph = parseGraph(JSON.stringify(fixture));
const edge = required(graph.edges[0]);

test('authored geometry overrides style/layout and shares an arc-length label anchor', () => {
  const styled = { ...edge, pathStyle: 'smooth' as const };
  const route = [
    { x: 0, y: -100 },
    { x: 600, y: -100 },
  ];
  expect(edgePath(graph, styled, route)).toBe('M100,50 L200,200 L300,50');
  expect(resolveEdgeGeometry(graph, styled, { route })).toEqual({
    path: 'M100,50 L200,200 L300,50',
    labelPosition: { x: 200, y: 200 },
  });
});

test('literal v1 geometry survives detached save/reload and invalid authored data is rejected', () => {
  expect(JSON.parse(serializeGraph(graph))).toEqual(fixture);
  expect(createEditor(graph).graph).toEqual(graph);
  for (const waypoints of [
    [],
    null,
    [{ id: '', position: { x: 1, y: 2 } }],
    [
      { id: 'a', position: { x: 1, y: 2 } },
      { id: 'a', position: { x: 3, y: 4 } },
    ],
    [{ id: 'a', position: { x: '1', y: 2 } }],
  ]) {
    const wire = {
      ...fixture,
      graph: { ...fixture.graph, edges: [{ ...fixture.graph.edges[0], waypoints }] },
    };
    expect(() => parseGraph(JSON.stringify(wire))).toThrow();
  }
});

test('preview is pure, Apply detaches input, rechecks policy and makes one Undo/Redo transaction', () => {
  const initial = createEditor({
    nodes: graph.nodes,
    edges: [{ id: edge.id, source: edge.source, target: edge.target }],
  });
  const points = [{ id: 'turn', position: { x: 220, y: 240 } }];
  const request = { id: 'e', revision: initial.revision, waypoints: points };
  expect(resolveEdgeWaypointEdit(initial, request).type).toBe('allowed');
  expect(initial.past).toHaveLength(0);
  expect(initial.graph.edges[0]?.waypoints).toBeUndefined();
  const denied = updateEditor(
    initial,
    { type: 'EdgeWaypointsChanged', ...request },
    {
      canChangeEdgeWaypoints: () => 'Owned by platform team',
    },
  );
  expect(denied.graph).toBe(initial.graph);
  expect(denied.past).toBe(initial.past);
  expect(denied.notice).toBe('Owned by platform team');
  const edited = updateEditor(initial, { type: 'EdgeWaypointsChanged', ...request });
  expect(edited.past).toHaveLength(1);
  expect(edited.graph.edges[0]?.waypoints).toEqual(points);
  required(points[0]).position.x = -100;
  expect(edited.graph.edges[0]?.waypoints?.[0]?.position.x).toBe(220);
  const undone = updateEditor(edited, { type: 'UndoPressed' });
  expect(undone.graph).toEqual(initial.graph);
  expect(updateEditor(undone, { type: 'RedoPressed' }).graph).toEqual(edited.graph);
  const stale = updateEditor(undone, { type: 'EdgeWaypointsChanged', ...request });
  expect(stale.graph).toBe(undone.graph);
  expect(stale.future).toBe(undone.future);
});

test('read-only, hidden, missing, busy, history-disabled and invalid edits cannot publish', () => {
  const initial = createEditor(graph);
  const request = { id: 'e', revision: initial.revision, waypoints: null };
  const states = [
    createEditor(graph, { readOnly: true }),
    createEditor(graph, { historyLimit: 0 }),
    createEditor(graph, { visibility: { hiddenEdgeIds: ['e'] } }),
    { ...initial, connection: { node: 'a', port: 'out' } },
    { ...initial, edgeLabelDraft: { id: 'e', text: 'draft' } },
    updateEditor(initial, { type: 'PanStarted', pointer: 1, point: { x: 0, y: 0 } }),
  ];
  for (const state of states) {
    expect(resolveEdgeWaypointEdit(state, request).type).toBe('blocked');
    const after = updateEditor(state, { type: 'EdgeWaypointsChanged', ...request });
    expect(after.graph).toBe(state.graph);
    expect(after.past).toBe(state.past);
    expect(after.gesture).toBe(state.gesture);
  }
  expect(resolveEdgeWaypointEdit(initial, { ...request, id: 'missing' }).type).toBe('blocked');
  for (const x of [NaN, Infinity, -Infinity]) {
    expect(() =>
      updateEditor(initial, {
        type: 'EdgeWaypointsChanged',
        ...request,
        waypoints: [{ id: 'bad', position: { x, y: 0 } }],
      }),
    ).toThrow();
  }
  expect(initial.past).toHaveLength(0);
  expect(initial.graph).toEqual(graph);
  expect(resolveEdgeWaypointEdit(initial, request, { canChangeEdgeWaypoints: () => ' ' })).toEqual({
    type: 'blocked',
    reason: 'Waypoint editing is unavailable.',
  });
});

test('no-op and reset retain fresh layout routes; custom geometry remains authoritative', () => {
  const initial = {
    ...createEditor(graph),
    routes: [
      {
        id: 'e',
        points: [
          { x: 100, y: 50 },
          { x: 200, y: -90 },
          { x: 300, y: 50 },
        ],
      },
    ],
  };
  expect(
    updateEditor(initial, {
      type: 'EdgeWaypointsChanged',
      id: 'e',
      revision: 0,
      waypoints: required(edge.waypoints),
    }),
  ).toBe(initial);
  const cleared = updateEditor(initial, {
    type: 'EdgeWaypointsChanged',
    id: 'e',
    revision: 0,
    waypoints: null,
  });
  expect(cleared.graph.edges[0]?.waypoints).toBeUndefined();
  expect(cleared.routes).toBe(initial.routes);
  expect(edgePath(cleared.graph, required(cleared.graph.edges[0]), cleared.routes[0]?.points)).toBe(
    'M100,50 L200,-90 L300,50',
  );
  expect(
    updateEditor(cleared, { type: 'EdgeWaypointsChanged', id: 'e', revision: 1, waypoints: null }),
  ).toBe(cleared);
  expect(
    resolveEdgeGeometry(graph, edge, {
      policy: () => ({ path: 'M1,2 L3,4', labelPosition: { x: 2, y: 3 } }),
    }),
  ).toEqual({ path: 'M1,2 L3,4', labelPosition: { x: 2, y: 3 } });
});

test('world-space bends survive endpoint movement, layout and reconnection', () => {
  let state = updateEditor(createEditor(graph), { type: 'NodeSelected', id: 'a', additive: false });
  state = updateEditor(state, { type: 'SelectionNudged', delta: { x: 20, y: 10 } });
  expect(state.graph.edges[0]?.waypoints).toEqual(edge.waypoints);
  expect(edgePath(state.graph, required(state.graph.edges[0]))).toBe('M120,60 L200,200 L300,50');
  const request = layoutRequest(state, 'layout');
  state = applyLayout(state, request, {
    requestId: 'layout',
    revision: request.revision,
    positions: [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 600, y: 0 },
    ],
    routes: [
      {
        id: 'e',
        points: [
          { x: 100, y: 50 },
          { x: 600, y: 50 },
        ],
      },
    ],
  });
  expect(edgePath(state.graph, required(state.graph.edges[0]), state.routes[0]?.points)).toBe(
    'M100,50 L200,200 L600,50',
  );
  const node = { ...required(graph.nodes[1]), id: 'c', position: { x: 500, y: 300 } };
  const extended = createEditor({ nodes: [...graph.nodes, node], edges: graph.edges });
  const reconnected = updateEditor(extended, {
    type: 'EdgeReconnected',
    id: 'e',
    end: 'target',
    endpoint: { node: 'c', port: 'in' },
  });
  expect(edgePath(reconnected.graph, required(reconnected.graph.edges[0]))).toBe(
    'M100,50 L200,200 L500,350',
  );
});

test('copy and pattern insertion translate bends, preserve edge-local IDs and detach source', () => {
  let state = updateEditor(createEditor(graph), { type: 'NodeSelected', id: 'a', additive: false });
  state = updateEditor(state, { type: 'NodeSelected', id: 'b', additive: true });
  state = updateEditor(state, { type: 'CopyPressed' });
  state = updateEditor(state, { type: 'PastePressed' });
  expect(state.graph.edges[1]?.waypoints).toEqual([{ id: 'bend', position: { x: 240, y: 240 } }]);
  const inserted = insertPattern(createEditor({ nodes: [], edges: [] }), graph, {
    offset: { x: -20, y: 30 },
  });
  expect(inserted.type).toBe('inserted');
  if (inserted.type !== 'inserted') throw new Error('Expected insertion');
  expect(inserted.editor.graph.edges[0]?.waypoints).toEqual([
    { id: 'bend', position: { x: 180, y: 230 } },
  ]);
  expect(graph.edges[0]?.waypoints?.[0]?.position).toEqual({ x: 200, y: 200 });
});

test('history records waypoint identity and position as layout changes, not changed meaning', () => {
  const before = captureEdition({ id: 'before', name: 'Before', snapshot: { graph } });
  const moved = updateEditor(createEditor(graph), {
    type: 'EdgeWaypointsChanged',
    id: 'e',
    revision: 0,
    waypoints: [{ id: 'renamed', position: { x: 200, y: 200 } }],
  });
  const after = captureEdition({ id: 'after', name: 'After', snapshot: { graph: moved.graph } });
  const comparison = compareEditions(before, after);
  expect(comparison.edges).toHaveLength(1);
  expect(comparison.edges[0]).toMatchObject({
    id: 'e',
    semanticChanged: false,
    layoutChanged: true,
  });
  expect(
    parseModelDocument(
      serializeModelDocument({
        id: 'model',
        name: 'Model',
        snapshot: { graph },
        editions: [before, after],
        origin: null,
      }),
    ).snapshot.graph,
  ).toEqual(graph);
});

test('bounds and culling include detours, while collapsed projections suppress stored bends', () => {
  const detourGraph = {
    ...graph,
    edges: [{ ...edge, waypoints: [{ id: 'far', position: { x: 2000, y: 2000 } }] }],
  };
  const surface = { width: 500, height: 400 };
  const viewport = { x: 0, y: 0, zoom: 1 };
  const overview = minimapGeometry(detourGraph, surface, viewport);
  expect(overview.x + overview.width).toBeGreaterThan(2000);
  expect(overview.y + overview.height).toBeGreaterThan(2000);
  const fitted = fitViewport(detourGraph, surface);
  expect(2000 * fitted.zoom + fitted.x).toBeLessThanOrEqual(500 - 24);
  expect(2000 * fitted.zoom + fitted.y).toBeLessThanOrEqual(400 - 24);
  const state = {
    ...createEditor(detourGraph, { viewport: { x: -1800, y: -1800, zoom: 1 } }),
    surface,
  };
  const presentation = presentVisibleGraph(state);
  expect(
    viewportItems(state, presentation, new Map(), false, { overscan: 0 }).edges.map((e) => e.id),
  ).toEqual(['e']);
  const group = {
    id: 'g',
    label: 'Frame',
    kind: 'group' as const,
    position: { x: -30, y: -30 },
    size: { width: 200, height: 180 },
    ports: [],
  };
  const grouped = createEditor({
    nodes: [group, { ...required(graph.nodes[0]), parentId: 'g' }, required(graph.nodes[1])],
    edges: detourGraph.edges,
  });
  const collapsed = updateEditor(grouped, { type: 'GroupCollapseToggled', id: 'g' });
  expect(
    resolveEdgeWaypointEdit(collapsed, { id: 'e', revision: collapsed.revision, waypoints: null })
      .type,
  ).toBe('blocked');
  const geometry = resolveEdgeGeometry(collapsed.graph, required(collapsed.graph.edges[0]), {
    sourceGroup: group,
  });
  expect(geometry.path).not.toContain('2000');
  expect(minimapGeometry(presentVisibleGraph(collapsed), surface, viewport).width).toBeLessThan(
    2000,
  );
  expect(collapsed.graph.edges[0]?.waypoints).toEqual(detourGraph.edges[0]?.waypoints);
});

test('reconnection preview retains named bends without publishing a graph edit', () => {
  const initial = createEditor(graph);
  const dragging = updateEditor(initial, {
    type: 'ReconnectionDragStarted',
    id: 'e',
    end: 'target',
    pointer: 1,
    point: { x: 450, y: 300 },
  });
  const preview = resolveConnectionPreview(dragging);
  expect(preview?.path).toBe('M100,50 L200,200 L450,300');
  expect(dragging.graph).toBe(initial.graph);
  expect(updateEditor(dragging, { type: 'GestureCancelled' }).graph).toBe(initial.graph);
});

test('fit, reveal and minimap input use the same detour envelope', () => {
  const detour = {
    ...graph,
    edges: [{ ...edge, waypoints: [{ id: 'far', position: { x: 2000, y: 1800 } }] }],
  };
  const measured = updateEditor(createEditor(detour), {
    type: 'SurfaceMeasured',
    size: { width: 600, height: 500 },
  });
  const selected = updateEditor(measured, { type: 'EdgeSelected', id: 'e', additive: false });
  for (const type of ['FitViewClicked', 'FitSelectionClicked'] as const) {
    const fitted = updateEditor(selected, { type });
    expect(2000 * fitted.viewport.zoom + fitted.viewport.x).toBeLessThanOrEqual(576);
    expect(1800 * fitted.viewport.zoom + fitted.viewport.y).toBeLessThanOrEqual(476);
    expect(fitted.graph).toBe(selected.graph);
    expect(fitted.past).toHaveLength(0);
  }
  const revealed = updateEditor(measured, { type: 'EdgeRevealRequested', id: 'e' });
  expect(2000 * revealed.viewport.zoom + revealed.viewport.x).toBeLessThanOrEqual(576);
  const overview = required(minimapContext(measured));
  expect(overview.geometry.x + overview.geometry.width).toBeGreaterThan(2000);
  const centered = updateEditor(measured, { type: 'MinimapClicked', point: { x: 0.5, y: 0.5 } });
  expect(centered.viewport.x).toBeCloseTo(
    300 - (overview.geometry.x + overview.geometry.width / 2),
  );
  expect(centered.viewport.y).toBeCloseTo(
    250 - (overview.geometry.y + overview.geometry.height / 2),
  );
});

test('ordered waypoint identity is edge-local and survives deletion Undo', () => {
  const state = createEditor(graph);
  const changed = updateEditor(state, {
    type: 'EdgeWaypointsChanged',
    id: 'e',
    revision: state.revision,
    waypoints: [
      { id: 'b', position: { x: 250, y: 100 } },
      { id: 'a', position: { x: 150, y: 100 } },
    ],
  });
  expect(edgePath(changed.graph, required(changed.graph.edges[0]))).toBe(
    'M100,50 L250,100 L150,100 L300,50',
  );
  const selected = updateEditor(changed, { type: 'EdgeSelected', id: 'e', additive: false });
  const deleted = updateEditor(selected, { type: 'DeletePressed' });
  expect(deleted.graph.edges).toHaveLength(0);
  expect(updateEditor(deleted, { type: 'UndoPressed' }).graph).toEqual(changed.graph);
});
