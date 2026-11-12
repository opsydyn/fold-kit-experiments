import { expect, test } from 'bun:test';

import {
  createEditor,
  parseGraph,
  updateEditor,
  resolveEdgeWaypointPreview,
  resolveEdgeWaypointControls,
  serializeGraph,
} from '../src/index';
import fixture from './fixtures/waypoints-v1.json';

const graph = parseGraph(JSON.stringify(fixture));
const start = () =>
  updateEditor(createEditor(graph, { viewport: { x: 0, y: 0, zoom: 2 }, snapToGrid: true }), {
    type: 'EdgeWaypointDragStarted',
    id: 'e',
    waypointId: 'bend',
    revision: 0,
    pointer: 1,
    point: { x: 400, y: 400 },
  });

test('drag stays transient, is zoom aware and commits exactly once on release', () => {
  const initial = start();
  const moved = updateEditor(initial, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 430, y: 450 },
  });
  expect(moved.graph).toBe(initial.graph);
  expect(moved.past).toHaveLength(0);
  const released = updateEditor(moved, { type: 'PointerReleased', pointer: 1 });
  expect(released.graph.edges[0]?.waypoints?.[0]?.position).toEqual({ x: 220, y: 220 });
  expect(released.past).toHaveLength(1);
  expect(updateEditor(released, { type: 'UndoPressed' }).graph).toEqual(graph);
  expect(updateEditor(released, { type: 'PointerReleased', pointer: 1 })).toBe(released);
});

test('Escape and foreign pointers cannot publish; late policy changes and revision changes reject', () => {
  const initial = start();
  expect(
    updateEditor(initial, { type: 'PointerMoved', pointer: 2, point: { x: 440, y: 440 } }),
  ).toBe(initial);
  const moved = updateEditor(initial, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 440, y: 440 },
  });
  const cancelled = updateEditor(moved, { type: 'GestureCancelled' });
  expect(cancelled.graph).toBe(initial.graph);
  expect(cancelled.past).toHaveLength(0);
  expect(updateEditor(cancelled, { type: 'PointerReleased', pointer: 1 })).toBe(cancelled);
  const denied = updateEditor(
    moved,
    { type: 'PointerReleased', pointer: 1 },
    { canChangeEdgeWaypoints: () => 'Protected route' },
  );
  expect(denied.graph).toBe(initial.graph);
  expect(denied.notice).toBe('Protected route');
  expect(denied.past).toHaveLength(0);
  const stale = updateEditor(
    { ...moved, revision: moved.revision + 1 },
    { type: 'PointerReleased', pointer: 1 },
  );
  expect(stale.graph).toBe(initial.graph);
  expect(stale.past).toHaveLength(0);
});

test('modifier-only bypass recomputes the last sample; no-op and cancellation create no history', () => {
  let state = updateEditor(start(), {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 430, y: 450 },
  });
  expect(resolveEdgeWaypointPreview(state).type).toBe('allowed');
  state = updateEditor(state, {
    type: 'EdgeWaypointSnapBypassChanged',
    pointer: 1,
    bypassed: true,
  });
  const free = resolveEdgeWaypointPreview(state);
  expect(free.type === 'allowed' ? free.edge.waypoints?.[0]?.position : null).toEqual({
    x: 215,
    y: 225,
  });
  state = updateEditor(state, {
    type: 'EdgeWaypointSnapBypassChanged',
    pointer: 1,
    bypassed: false,
  });
  const snapped = resolveEdgeWaypointPreview(state);
  expect(snapped.type === 'allowed' ? snapped.edge.waypoints?.[0]?.position : null).toEqual({
    x: 220,
    y: 220,
  });
  expect(parseGraph(serializeGraph(state.graph))).toEqual(graph);
  const cancelled = updateEditor(state, { type: 'GestureCancelled' });
  expect(cancelled.past).toHaveLength(0);
  expect(updateEditor(start(), { type: 'PointerReleased', pointer: 1 }).past).toHaveLength(0);
});

test('keyboard moves/removes have source revision guards and one Undo each', () => {
  const initial = createEditor(graph, { snapToGrid: true });
  const moved = updateEditor(initial, {
    type: 'EdgeWaypointNudged',
    id: 'e',
    waypointId: 'bend',
    revision: 0,
    delta: { x: 20, y: 0 },
  });
  expect(moved.graph.edges[0]?.waypoints?.[0]?.position).toEqual({ x: 220, y: 200 });
  expect(moved.past).toHaveLength(1);
  const free = updateEditor(moved, {
    type: 'EdgeWaypointNudged',
    id: 'e',
    waypointId: 'bend',
    revision: moved.revision,
    delta: { x: 1, y: 0 },
    snapBypassed: true,
  });
  expect(free.graph.edges[0]?.waypoints?.[0]?.position).toEqual({ x: 221, y: 200 });
  const stale = updateEditor(free, {
    type: 'EdgeWaypointRemoved',
    id: 'e',
    waypointId: 'bend',
    revision: 0,
  });
  expect(stale.graph).toBe(free.graph);
  const removed = updateEditor(free, {
    type: 'EdgeWaypointRemoved',
    id: 'e',
    waypointId: 'bend',
    revision: free.revision,
  });
  expect(removed.graph.edges[0]?.waypoints).toBeUndefined();
  expect(removed.past).toHaveLength(3);
  expect(updateEditor(removed, { type: 'UndoPressed' }).graph).toEqual(free.graph);
});

test('controls allocate edge-local IDs, retain reasons and expose the actual transient handle position', () => {
  const initial = createEditor(graph);
  const context = resolveEdgeWaypointControls(initial, 'e');
  if (!context) throw new Error('Expected controls');
  const added = updateEditor(initial, context.add.event);
  expect(added.graph.edges[0]?.waypoints?.map((waypoint) => waypoint.id)).toEqual([
    'waypoint:1',
    'bend',
  ]);
  const next = resolveEdgeWaypointControls(added, 'e');
  if (!next) throw new Error('Expected controls');
  const twice = updateEditor(added, next.add.event);
  expect(twice.graph.edges[0]?.waypoints?.some((waypoint) => waypoint.id === 'waypoint:2')).toBe(
    true,
  );
  const locked = resolveEdgeWaypointControls(initial, 'e', {
    canChangeEdgeWaypoints: () => 'Protected route',
  });
  expect(locked?.handles[0]?.reason).toBe('Protected route');
  expect(locked?.add.reason).toBe('Protected route');
  const dragging = updateEditor(start(), {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 430, y: 450 },
  });
  const preview = resolveEdgeWaypointControls(dragging, 'e');
  expect(preview?.handles[0]?.waypoint.position).toEqual({ x: 220, y: 220 });
  expect(preview?.handles[0]?.active).toBe(true);
  expect(preview?.add.reason).toContain('Finish');
  const readOnly = updateEditor(
    { ...dragging, readOnly: true },
    { type: 'PointerReleased', pointer: 1 },
  );
  expect(readOnly.graph).toBe(dragging.graph);
  expect(readOnly.past).toHaveLength(0);
});

test('a fresh document change survives stale drag release; cancellation preserves an existing redo branch', () => {
  const moved = updateEditor(start(), {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 440, y: 440 },
  });
  const measured = updateEditor(moved, {
    type: 'NodeMeasured',
    id: 'a',
    size: { width: 100, height: 140 },
  });
  expect(measured.revision).toBeGreaterThan(moved.revision);
  const released = updateEditor(measured, { type: 'PointerReleased', pointer: 1 });
  expect(released.graph).toBe(measured.graph);
  expect(released.graph.nodes[0]?.size.height).toBe(140);
  expect(released.graph.edges[0]?.waypoints?.[0]?.position).toEqual({ x: 200, y: 200 });
  const edited = updateEditor(createEditor(graph), {
    type: 'EdgeWaypointNudged',
    id: 'e',
    waypointId: 'bend',
    revision: 0,
    delta: { x: 20, y: 0 },
  });
  const undone = updateEditor(edited, { type: 'UndoPressed' });
  const drag = updateEditor(undone, {
    type: 'EdgeWaypointDragStarted',
    id: 'e',
    waypointId: 'bend',
    revision: undone.revision,
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const cancelled = updateEditor(
    updateEditor(drag, { type: 'PointerMoved', pointer: 1, point: { x: 20, y: 20 } }),
    { type: 'GestureCancelled' },
  );
  expect(cancelled.future).toBe(undone.future);
  expect(updateEditor(cancelled, { type: 'RedoPressed' }).graph).toEqual(edited.graph);
});

test('collapsed endpoints suppress authored handles while retaining the model and protection reason', () => {
  const frame = {
    id: 'frame',
    label: 'Frame',
    kind: 'group' as const,
    ports: [],
    position: { x: -20, y: -20 },
    size: { width: 180, height: 180 },
  };
  const grouped = createEditor({
    nodes: [
      frame,
      ...graph.nodes.map((node) => (node.id === 'a' ? { ...node, parentId: 'frame' } : node)),
    ],
    edges: graph.edges,
  });
  const collapsed = updateEditor(grouped, { type: 'GroupCollapseToggled', id: 'frame' });
  const context = resolveEdgeWaypointControls(collapsed, 'e');
  expect(context?.handles).toEqual([]);
  expect(context?.reason).toContain('unavailable');
  expect(collapsed.graph.edges[0]?.waypoints).toEqual(graph.edges[0]?.waypoints);
});
