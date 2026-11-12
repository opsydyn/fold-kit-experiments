import { expect, test } from 'bun:test';

import {
  createArchitecturePattern,
  createEditor,
  createPlacement,
  updatePlacement,
  resolvePlacement,
  applyPlacement,
  updateEditor,
  parseGraph,
  serializeGraph,
  type ZlozPlacement,
  type ZlozPlacementTarget,
  type ZlozPlacementIntent,
  type ZlozPlacementContext,
} from '../src/index';
import waypointFixture from './fixtures/waypoints-v1.json';

const fragment = createArchitecturePattern('c4-context');
const sourceNode = fragment.nodes[0];
if (!sourceNode) throw new Error('Source fixture requires a node');
function fixture() {
  const editor = createEditor({ nodes: [], edges: [] });
  const context: ZlozPlacementContext = { scope: 'model/session-a', editor };
  const idle = createPlacement(context.scope);
  const active = updatePlacement(idle, context, {
    type: 'PlacementStarted',
    scope: context.scope,
    generation: idle.generation,
    intent: { source: { type: 'palette', id: 'c4-card' }, fragment, anchor: { x: 30, y: 65 } },
  });
  const placement = updatePlacement(active, context, {
    type: 'PlacementTargetChanged',
    scope: context.scope,
    generation: active.generation,
    target: { space: 'world', point: { x: 100, y: 200 } },
  });
  return { context, placement };
}

test('preview is detached and non-publishing; placement inserts a fragment as one Undo', () => {
  const { context, placement } = fixture();
  const preview = resolvePlacement(placement, context);
  expect(preview.type).toBe('ready');
  if (preview.type !== 'ready') throw new Error('Expected preview');
  expect(preview.fragment.nodes[0]?.position).toEqual({ x: 100, y: 200 });
  expect(context.editor.graph.nodes).toHaveLength(0);
  expect(context.editor.past).toHaveLength(0);
  Object.assign(preview.fragment.nodes[0] ?? {}, { label: 'Tampered preview' });
  const applied = applyPlacement(placement, context, preview.request);
  expect(applied.type).toBe('placed');
  if (applied.type !== 'placed') throw new Error('Expected placement');
  expect(applied.editor.graph.nodes[0]?.label).toBe('Person');
  expect(applied.editor.graph.nodes[0]?.position).toEqual({ x: 100, y: 200 });
  expect(applied.editor.past).toHaveLength(1);
  expect(updateEditor(applied.editor, { type: 'UndoPressed' }).graph).toEqual(context.editor.graph);
  expect(applied.placement.type).toBe('idle');
});

function at(
  context: ZlozPlacementContext,
  target: ZlozPlacementTarget,
  intent: ZlozPlacementIntent = {
    source: { type: 'external', id: 'foreign-card' },
    fragment,
    anchor: { x: 30, y: 65 },
  },
) {
  const idle = createPlacement(context.scope);
  const active = updatePlacement(idle, context, {
    type: 'PlacementStarted',
    scope: context.scope,
    generation: idle.generation,
    intent,
  });
  return updatePlacement(active, context, {
    type: 'PlacementTargetChanged',
    scope: context.scope,
    generation: active.generation,
    target,
  });
}
function ready(placement: ZlozPlacement, context: ZlozPlacementContext) {
  const preview = resolvePlacement(placement, context);
  if (preview.type !== 'ready') throw new Error(`Expected ready placement, got ${preview.type}`);
  return preview;
}
const emptyContext = (): ZlozPlacementContext => ({
  scope: 'canvas/a',
  editor: createEditor({ nodes: [], edges: [] }),
});

test('client, canvas-local and world coordinates agree under nested/scrolled origins and zoom', () => {
  const editor = updateEditor(
    createEditor({ nodes: [], edges: [] }, { viewport: { x: 100, y: 50, zoom: 2 } }),
    { type: 'SurfaceMeasured', size: { width: 800, height: 600 } },
  );
  const context = { scope: 'nested/canvas', editor, origin: { x: 300, y: -200 } };
  for (const target of [
    { space: 'client', point: { x: 500, y: 50 } },
    { space: 'screen', point: { x: 200, y: 250 } },
    { space: 'world', point: { x: 50, y: 100 } },
  ] as const) {
    const placement = at(context, target);
    const preview = ready(placement, context);
    expect(preview.position).toEqual({ x: 50, y: 100 });
    expect(preview.fragment.nodes[0]?.position).toEqual({ x: 50, y: 100 });
    expect(preview.source).toEqual({ type: 'external', id: 'foreign-card' });
  }
});

test('grid and node-frame anchor snapping are deterministic, zoom-aware and bypassable', () => {
  const source = createArchitecturePattern('c4-context');
  const editor = createEditor(
    { nodes: source.nodes, edges: [] },
    { snapToGrid: true, gridSpacing: 20, viewport: { x: 0, y: 0, zoom: 2 } },
  );
  const context = { scope: 'snap', editor };
  const intent: ZlozPlacementIntent = {
    source: { type: 'palette', id: 'node' },
    fragment,
    anchor: { x: 30, y: 65 },
    snapping: { anchorDistance: 10, anchors: ['center'] },
  };
  const placement = at(context, { space: 'world', point: { x: 154, y: 135 } }, intent);
  const snapped = ready(placement, context);
  expect(snapped.snap.type).toBe('anchor');
  expect(snapped.position).toEqual({ x: 150, y: 135 });
  expect(snapped.snap.anchor).toEqual({ nodeId: 'source', kind: 'center' });
  const grid = ready(at(context, { space: 'world', point: { x: 157, y: 135 } }, intent), context);
  expect(grid.snap.type).toBe('grid');
  expect(grid.position).toEqual({ x: 160, y: 140 });
  const free = ready(
    at(context, { space: 'world', point: { x: 154, y: 135 }, snapBypassed: true }, intent),
    context,
  );
  expect(free.snap.type).toBe('none');
  expect(free.position).toEqual({ x: 154, y: 135 });
  const tieNodes = source.nodes.map((node) => ({
    ...node,
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
  }));
  const tie = { ...context, editor: createEditor({ nodes: tieNodes, edges: [] }) };
  const reversed = { ...tie, editor: createEditor({ nodes: [...tieNodes].reverse(), edges: [] }) };
  expect(
    ready(at(tie, { space: 'world', point: { x: 50, y: 50 } }, intent), tie).snap.anchor,
  ).toEqual(
    ready(at(reversed, { space: 'world', point: { x: 50, y: 50 } }, intent), reversed).snap.anchor,
  );
});

test('captured source and input points are detached; invalid intents reject without changing the prior session', () => {
  const context = emptyContext();
  const idle = createPlacement(context.scope);
  const source = createArchitecturePattern('c4-context');
  const started = updatePlacement(idle, context, {
    type: 'PlacementStarted',
    scope: context.scope,
    generation: 0,
    intent: {
      source: { type: 'external', id: 'drop' },
      fragment: source,
      anchor: { x: 30, y: 65 },
    },
  });
  Object.assign(source.nodes[0]?.position ?? {}, { x: 999 });
  const target = { space: 'world' as const, point: { x: 50, y: 60 } };
  const placement = updatePlacement(started, context, {
    type: 'PlacementTargetChanged',
    scope: context.scope,
    generation: started.generation,
    target,
  });
  target.point.x = 800;
  const preview = ready(placement, context);
  expect(preview.fragment.nodes[0]?.position).toEqual({ x: 50, y: 60 });
  expect(Object.isFrozen(source.nodes[0])).toBe(false);
  if (placement.type !== 'placing') throw new Error('Expected active placement');
  expect(Object.isFrozen(placement.intent.fragment.nodes[0]?.position)).toBe(true);
  for (const anchor of [
    { x: NaN, y: 0 },
    { x: 0, y: Infinity },
  ]) {
    expect(() =>
      updatePlacement(idle, context, {
        type: 'PlacementStarted',
        scope: context.scope,
        generation: 0,
        intent: { source: { type: 'palette', id: 'bad' }, fragment, anchor },
      }),
    ).toThrow();
  }
  for (const snapping of [{ anchorDistance: -1 }, { anchors: ['center', 'center'] as const }]) {
    expect(() =>
      updatePlacement(idle, context, {
        type: 'PlacementStarted',
        scope: context.scope,
        generation: 0,
        intent: {
          source: { type: 'palette', id: 'bad' },
          fragment,
          anchor: { x: 0, y: 0 },
          snapping,
        },
      }),
    ).toThrow();
  }
  expect(idle.type).toBe('idle');
});

test('cancel, restart, owner changes and a new reviewed target reject queued callbacks', () => {
  const { context, placement } = fixture();
  const preview = ready(placement, context);
  const moved = updatePlacement(placement, context, {
    type: 'PlacementTargetChanged',
    scope: context.scope,
    generation: placement.generation,
    target: { space: 'world', point: { x: 500, y: 200 } },
  });
  expect(applyPlacement(moved, context, preview.request).type).toBe('blocked');
  const cancelled = updatePlacement(moved, context, {
    type: 'PlacementCancelled',
    scope: context.scope,
    generation: moved.generation,
  });
  expect(applyPlacement(cancelled, context, preview.request).type).toBe('blocked');
  expect(
    updatePlacement(cancelled, context, {
      type: 'PlacementTargetChanged',
      scope: context.scope,
      generation: placement.generation,
      target: { space: 'world', point: { x: 0, y: 0 } },
    }),
  ).toBe(cancelled);
  const other = { ...context, scope: 'model/session-b' };
  const nextOwner = at(other, { space: 'world', point: { x: 100, y: 200 } });
  expect(applyPlacement(nextOwner, other, preview.request).type).toBe('blocked');
  expect(resolvePlacement(placement, other).type).toBe('blocked');
  const fresh = ready(moved, context);
  const applied = applyPlacement(moved, context, fresh.request);
  if (applied.type !== 'placed') throw new Error('Expected placement');
  expect(applied.editor.graph.nodes[0]?.position).toEqual({ x: 500, y: 200 });
  expect(
    applyPlacement(applied.placement, { ...context, editor: applied.editor }, fresh.request).type,
  ).toBe('blocked');
});

test('live view/configuration changes reject stale screen/client targets; world targets survive panning', () => {
  const context = {
    scope: 'view',
    editor: updateEditor(createEditor({ nodes: [], edges: [] }), {
      type: 'SurfaceMeasured',
      size: { width: 800, height: 600 },
    }),
    origin: { x: 20, y: 100 },
  };
  const placement = at(context, { space: 'client', point: { x: 220, y: 300 } });
  const preview = ready(placement, context);
  const pan = {
    ...context,
    editor: updateEditor(context.editor, {
      type: 'ViewportChanged',
      viewport: { x: 10, y: 0, zoom: 1 },
    }),
  };
  for (const changed of [
    pan,
    { ...context, origin: { x: 21, y: 100 } },
    { ...context, editor: { ...context.editor, surface: { width: 900, height: 600 } } },
  ]) {
    expect(applyPlacement(placement, changed, preview.request).type).toBe('blocked');
  }
  expect(
    resolvePlacement(at(context, { space: 'screen', point: { x: -1, y: 0 } }), context).type,
  ).toBe('blocked');
  const world = at(context, { space: 'world', point: { x: 200, y: 200 } });
  expect(resolvePlacement(world, pan).type).toBe('ready');
  const grid = at(
    { ...context, editor: { ...context.editor, snapToGrid: true } },
    { space: 'world', point: { x: 199, y: 199 } },
  );
  expect(
    resolvePlacement(grid, {
      ...context,
      editor: { ...context.editor, snapToGrid: true, gridSpacing: 40 },
    }).type,
  ).toBe('blocked');
});

test('source revision, read-only, busy, Undo-disabled and late policy checks preserve editor/history identity', () => {
  const { context, placement } = fixture();
  const preview = ready(placement, context);
  const changed = updateEditor(context.editor, { type: 'NodeAdded', node: sourceNode });
  for (const editor of [
    changed,
    createEditor(context.editor.graph, { readOnly: true }),
    createEditor(context.editor.graph, { historyLimit: 0 }),
    { ...context.editor, connection: { node: 'pending', port: 'out' } },
  ]) {
    const denied = applyPlacement(placement, { ...context, editor }, preview.request);
    expect(denied.type).toBe('blocked');
    expect(denied.editor).toBe(editor);
    expect(denied.placement).toBe(placement);
    expect(denied.editor.past).toBe(editor.past);
    expect(denied.editor.future).toBe(editor.future);
  }
  const late = applyPlacement(placement, context, preview.request, {
    canPlace: () => 'External placement is disabled',
  });
  expect(late.type).toBe('blocked');
  expect(late.type === 'blocked' ? late.reason : '').toBe('External placement is disabled');
  expect(late.editor).toBe(context.editor);
});

test('nested fragments attach only their roots, retain world coordinates and translate authored bends', () => {
  const frame = {
    id: 'host',
    label: 'Host',
    kind: 'group' as const,
    ports: [],
    position: { x: 0, y: 0 },
    size: { width: 1000, height: 800 },
  };
  const context = { scope: 'parent', editor: createEditor({ nodes: [frame], edges: [] }) };
  const nested = createArchitecturePattern('ddd-aggregate');
  const placement = at(
    context,
    { space: 'world', point: { x: 100, y: 100 }, parentId: 'host' },
    { source: { type: 'external', id: 'aggregate' }, fragment: nested, anchor: { x: 0, y: 0 } },
  );
  const preview = ready(placement, context);
  const rootId = preview.nodeIds.get('boundary');
  if (!rootId) throw new Error('Expected remapped root');
  expect(preview.fragment.nodes.find((node) => node.id === rootId)).toMatchObject({
    parentId: 'host',
    extent: 'parent',
    position: { x: 100, y: 100 },
  });
  expect(preview.fragment.nodes[1]?.parentId).toBe(rootId);
  const applied = applyPlacement(placement, context, preview.request);
  expect(applied.editor.selectedNodes).toEqual([rootId]);
  expect(applied.editor.graph.nodes[0]).toEqual(frame);
  const constrained = at(
    context,
    { space: 'world', point: { x: 900, y: 100 }, parentId: 'host' },
    { source: { type: 'palette', id: 'large' }, fragment: nested, anchor: { x: 0, y: 0 } },
  );
  expect(resolvePlacement(constrained, context).type).toBe('blocked');
  expect(
    resolvePlacement(placement, {
      ...context,
      editor: updateEditor(context.editor, { type: 'GroupCollapseToggled', id: 'host' }),
    }).type,
  ).toBe('blocked');
  const loose = at(context, {
    space: 'world',
    point: { x: 900, y: 100 },
    parentId: 'host',
    constrainToParent: false,
  });
  expect(ready(loose, context).fragment.nodes[0]?.extent).toBeUndefined();
  const authored = parseGraph(JSON.stringify(waypointFixture));
  const bends = ready(
    at(
      context,
      { space: 'world', point: { x: 100, y: 100 } },
      { source: { type: 'external', id: 'wire' }, fragment: authored, anchor: { x: 0, y: 0 } },
    ),
    context,
  );
  expect(bends.fragment.edges[0]?.waypoints?.[0]?.position).toEqual({ x: 300, y: 300 });
});

test('all policy layers see complete remapped proposals; a late edge veto is atomic and does not consume IDs', () => {
  const context = emptyContext();
  const intent: ZlozPlacementIntent = {
    source: { type: 'external', id: 'process' },
    fragment: createArchitecturePattern('event-storming'),
    anchor: { x: 0, y: 0 },
  };
  const placement = at(context, { space: 'world', point: { x: 100, y: 100 } }, intent);
  const preview = ready(placement, context);
  const originalSecondId = intent.fragment.edges[1]?.id;
  const secondId = originalSecondId ? preview.edgeIds.get(originalSecondId) : null;
  const veto = applyPlacement(placement, context, preview.request, {
    canConnect: (edge, graph) => {
      expect(graph.nodes).toHaveLength(intent.fragment.nodes.length);
      return edge.id === secondId ? 'Protected second connection' : null;
    },
  });
  expect(veto.type).toBe('blocked');
  expect(veto.editor).toBe(context.editor);
  const bulk = resolvePlacement(placement, context, {
    canPlace: (candidate) => {
      expect(candidate.source).toEqual(intent.source);
      expect(candidate.graph.nodes).toHaveLength(intent.fragment.nodes.length);
      expect(candidate.fragment.nodes[0]?.id).not.toBe(intent.fragment.nodes[0]?.id);
      return 'Bulk policy';
    },
  });
  expect(bulk).toEqual({ type: 'blocked', reason: 'Bulk policy' });
  expect(
    resolvePlacement(placement, context, { canInsertPattern: () => 'Insertion policy' }),
  ).toEqual({ type: 'blocked', reason: 'Insertion policy' });
  expect(resolvePlacement(placement, context, { canConnectPort: () => 'Port policy' })).toEqual({
    type: 'blocked',
    reason: 'Port policy',
  });
  const allowed = applyPlacement(placement, context, preview.request, {
    canSelectNode: () => 'Selection protected',
  });
  expect(allowed.type).toBe('placed');
  expect(allowed.editor.selectedNodes).toEqual([]);
  if (allowed.type === 'placed') expect([...allowed.nodeIds]).toEqual([...preview.nodeIds]);
});

test('visible anchor changes require a fresh target; disabling anchors keeps world placement independent of zoom', () => {
  const base = createArchitecturePattern('c4-context');
  const context = {
    scope: 'visible-anchors',
    editor: createEditor({ nodes: base.nodes, edges: [] }),
  };
  const intent: ZlozPlacementIntent = {
    source: { type: 'palette', id: 'snap' },
    fragment,
    anchor: { x: 30, y: 65 },
    snapping: { grid: false, anchorDistance: 12, anchors: ['top-left'] },
  };
  const placement = at(context, { space: 'world', point: { x: 34, y: 68 } }, intent);
  const preview = ready(placement, context);
  expect(preview.position).toEqual({ x: 30, y: 65 });
  const hidden = {
    ...context,
    editor: updateEditor(context.editor, {
      type: 'VisibilityChanged',
      visibility: { hiddenNodeIds: ['source'] },
    }),
  };
  expect(hidden.editor.revision).toBe(context.editor.revision);
  expect(applyPlacement(placement, hidden, preview.request).type).toBe('blocked');
  const refreshed = updatePlacement(placement, hidden, {
    type: 'PlacementTargetChanged',
    scope: hidden.scope,
    generation: placement.generation,
    target: { space: 'world', point: { x: 34, y: 68 } },
  });
  expect(ready(refreshed, hidden).snap.type).toBe('none');
  const disabled = at(
    context,
    { space: 'world', point: { x: 34, y: 68 } },
    { ...intent, snapping: { grid: false, anchorDistance: 12, anchors: [] } },
  );
  const zoomed = {
    ...context,
    editor: updateEditor(context.editor, {
      type: 'ViewportChanged',
      viewport: { x: 0, y: 0, zoom: 2 },
    }),
  };
  expect(ready(disabled, zoomed).snap.type).toBe('none');
});

test('malformed sources/targets reject, pending has no candidate and blocked/cancelled previews preserve redo', () => {
  const context = emptyContext();
  const idle = createPlacement(context.scope);
  expect(resolvePlacement(idle, context).type).toBe('idle');
  const active = updatePlacement(idle, context, {
    type: 'PlacementStarted',
    scope: context.scope,
    generation: 0,
    intent: { source: { type: 'palette', id: 'pending' }, fragment, anchor: { x: 30, y: 65 } },
  });
  expect(resolvePlacement(active, context).type).toBe('pending');
  for (const invalid of [
    { source: { type: 'script', id: 'bad' }, fragment, anchor: { x: 0, y: 0 } },
    { source: { type: 'external', id: ' ' }, fragment, anchor: { x: 0, y: 0 } },
    {
      source: { type: 'external', id: 'bad' },
      fragment: { nodes: [], edges: [] },
      anchor: { x: 0, y: 0 },
    },
    { source: { type: 'external', id: 'bad' }, fragment, anchor: { x: 0, y: 0 }, snapping: null },
  ]) {
    // SAFETY: Deliberately malformed runtime inputs qualify the public data boundary for untyped callers.
    const intent = invalid as ZlozPlacementIntent;
    expect(() =>
      updatePlacement(idle, context, {
        type: 'PlacementStarted',
        scope: context.scope,
        generation: 0,
        intent,
      }),
    ).toThrow();
  }
  expect(() =>
    updatePlacement(active, context, {
      type: 'PlacementTargetChanged',
      scope: context.scope,
      generation: active.generation,
      target: { space: 'world', point: { x: Infinity, y: 0 } },
    }),
  ).toThrow();
  const changed = updateEditor(context.editor, { type: 'NodeAdded', node: sourceNode });
  const undone = updateEditor(changed, { type: 'UndoPressed' });
  const current = { ...context, editor: undone };
  const placement = at(current, { space: 'world', point: { x: 10, y: 20 } });
  const preview = ready(placement, current);
  const blocked = applyPlacement(placement, current, preview.request, { canPlace: () => 'No' });
  expect(blocked.editor.future).toBe(undone.future);
  expect(blocked.editor.past).toBe(undone.past);
  expect(blocked.editor.graph).toBe(undone.graph);
  const cancelled = updatePlacement(placement, current, {
    type: 'PlacementCancelled',
    scope: current.scope,
    generation: placement.generation,
  });
  expect(cancelled.type).toBe('idle');
  expect(updateEditor(current.editor, { type: 'RedoPressed' }).graph).toEqual(changed.graph);
});

test('preview copies existing graph and parent data, and valid placement remains a canonical v1 document', () => {
  const frame = {
    id: 'host',
    label: 'Host',
    kind: 'group' as const,
    ports: [],
    position: { x: 0, y: 0 },
    size: { width: 1000, height: 800 },
    data: { owner: 'original' },
  };
  const context = { scope: 'detach', editor: createEditor({ nodes: [frame], edges: [] }) };
  const placement = at(context, { space: 'world', point: { x: 100, y: 100 }, parentId: 'host' });
  const preview = ready(placement, context);
  Object.assign(preview.parent?.data ?? {}, { owner: 'tampered' });
  Object.assign(preview.graph.nodes[0]?.position ?? {}, { x: -1000 });
  expect(context.editor.graph.nodes[0]?.data).toEqual({ owner: 'original' });
  expect(context.editor.graph.nodes[0]?.position).toEqual({ x: 0, y: 0 });
  const applied = applyPlacement(placement, context, preview.request);
  expect(applied.type).toBe('placed');
  expect(parseGraph(serializeGraph(applied.editor.graph))).toEqual(applied.editor.graph);
  expect(JSON.parse(serializeGraph(applied.editor.graph)).version).toBe(1);
});
