/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Geometric node shapes are domain concepts here, not structural placeholder names. */
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import {
  architectureNodePresets,
  ZlozError,
  createArchitectureNode,
  createEditor,
  updateEditor,
  nodeShapeGeometry,
  nodeShapeContainsPoint,
  nodeShapeBoundaryPoint,
  portPosition,
  portBoundaryPosition,
  edgePath,
  layoutRequest,
  applyLayout,
  parseGraph,
  serializeGraph,
  type ZlozNode,
  type ZlozNodeArchitecture,
} from '../src/index';

const legacy =
  '{"version":1,"graph":{"nodes":[{"id":"old","label":"Old","position":{"x":10,"y":20},"size":{"width":200,"height":100},"ports":[{"id":"out","kind":"output","side":"right","offset":0.5}],"data":{"socketPolicies":[],"host":{"value":42}}}],"edges":[]}}';
const modern = readFileSync(new URL('./fixtures/architecture-v1.json', import.meta.url), 'utf8');
const base = (): ZlozNode => parseGraph(legacy).nodes[0]!;

test('catalogue covers C4 and DDD roles and the standalone factory validates and detaches caller data', () => {
  expect(
    architectureNodePresets
      .filter(({ architecture }) => architecture.family === 'c4')
      .map(({ architecture }) => architecture.role),
  ).toEqual(['person', 'software-system', 'container', 'component']);
  expect(
    architectureNodePresets
      .filter(({ architecture }) => architecture.family === 'ddd')
      .map(({ architecture }) => architecture.role),
  ).toEqual([
    'entity',
    'value-object',
    'aggregate-root',
    'aggregate',
    'domain-event',
    'domain-service',
    'repository',
    'bounded-context',
  ]);
  for (const preset of architectureNodePresets) {
    const input = preset.kind
      ? { ...base(), kind: preset.kind, ports: [], architecture: preset.architecture }
      : { ...base(), architecture: preset.architecture };
    const node = createArchitectureNode(input);
    expect(node.architecture).toEqual(preset.architecture);
    expect(node.appearance?.shape).toBe(preset.shape);
    expect(node.data).toEqual(base().data);
  }
  const architecture = { family: 'c4', role: 'container', technology: 'Postgres' } as const;
  const input = { ...base(), architecture, appearance: { shape: 'cylinder' as const } };
  const node = createArchitectureNode(input);
  expect(node).not.toBe(input);
  expect(node.architecture).not.toBe(input.architecture);
  expect(node.data).not.toBe(input.data);
  expect(() =>
    createArchitectureNode({ ...base(), architecture: { family: 'ddd', role: 'aggregate' } }),
  ).toThrow();
});

test('literal v1 documents preserve descriptors and unrelated data through editing, copy, Undo and export', () => {
  expect(parseGraph(serializeGraph(parseGraph(legacy)))).toEqual(parseGraph(legacy));
  const graph = parseGraph(modern);
  const editor = createEditor(graph);
  const changed = updateEditor(editor, {
    type: 'NodeArchitectureChanged',
    id: 'store',
    architecture: { family: 'ddd', role: 'repository', description: 'Persists orders' },
  });
  expect(changed.graph.nodes[0]?.architecture).toEqual({
    family: 'ddd',
    role: 'repository',
    description: 'Persists orders',
  });
  expect(changed.graph.nodes[0]?.appearance).toEqual({ shape: 'cylinder' });
  expect(changed.graph.nodes[0]?.data).toEqual(graph.nodes[0]?.data);
  expect(parseGraph(serializeGraph(changed.graph))).toEqual(changed.graph);
  expect(updateEditor(changed, { type: 'UndoPressed' }).graph).toEqual(graph);
  const selected = updateEditor(editor, { type: 'NodeSelected', id: 'store', additive: false });
  const copied = updateEditor(selected, { type: 'CopyPressed' });
  expect(copied.clipboard?.nodes[0]?.architecture).toEqual(graph.nodes[0]?.architecture);
  expect(copied.clipboard?.nodes[0]?.appearance).toEqual({ shape: 'cylinder' });
});

test('malformed descriptors, impossible roles and group shapes are rejected at the document boundary', () => {
  for (const architecture of [
    null,
    { family: 'c4', role: 'entity' },
    { family: 'ddd', role: 'container' },
    { family: 'c4', role: 'person', technology: 'Wrong role' },
    { family: 'ddd', role: 'entity', subdomain: 'core' },
    { family: 'c4', role: 'container', technology: 7 },
    { family: 'c4', role: 'container', typo: true },
    { family: 'ddd', role: 'bounded-context', subdomain: { toString: 0 } },
  ]) {
    expect(() =>
      parseGraph(
        JSON.stringify({ version: 1, graph: { nodes: [{ ...base(), architecture }], edges: [] } }),
      ),
    ).toThrow(ZlozError);
  }
  for (const appearance of [null, { shape: 'triangle' }, { shape: 'cylinder', typo: 3 }]) {
    // SAFETY: deliberately crosses the typed boundary to verify runtime rejection of malformed graphs.
    expect(() =>
      createEditor({ nodes: [{ ...base(), appearance } as ZlozNode], edges: [] }),
    ).toThrow();
  }
  expect(() =>
    createEditor({
      nodes: [
        { ...base(), kind: 'group', ports: [], architecture: { family: 'ddd', role: 'entity' } },
      ],
      edges: [],
    }),
  ).toThrow();
  expect(() =>
    createEditor({
      nodes: [{ ...base(), kind: 'group', ports: [], appearance: { shape: 'cylinder' } }],
      edges: [],
    }),
  ).toThrow();
});

test('shape geometry has consistent outlines, content, containment and boundary coordinates after resize', () => {
  const node = { ...base(), appearance: { shape: 'cylinder' as const } };
  const geometry = nodeShapeGeometry(node);
  expect(() => nodeShapeGeometry({ ...node, size: { width: 0, height: 100 } })).toThrow(ZlozError);
  expect(() => nodeShapeBoundaryPoint(node, 'top', NaN)).toThrow(ZlozError);
  expect(geometry.shape).toBe('cylinder');
  expect(geometry.bounds).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  expect(geometry.contentBounds).toEqual({ x: 0, y: 32, width: 200, height: 36 });
  expect(geometry.outlinePath).toBe('M0,16 A100,16 0 0 1 200,16 L200,84 A100,16 0 0 1 0,84 Z');
  expect(nodeShapeBoundaryPoint(node, 'top', 0)).toEqual({ x: 10, y: 36 });
  expect(nodeShapeBoundaryPoint(node, 'top', 0.5)).toEqual({ x: 110, y: 20 });
  expect(nodeShapeBoundaryPoint(node, 'bottom', 1)).toEqual({ x: 210, y: 104 });
  expect(nodeShapeContainsPoint(node, { x: 10, y: 20 })).toBe(false);
  expect(nodeShapeContainsPoint(node, { x: 110, y: 20 })).toBe(true);
  expect(nodeShapeContainsPoint(node, { x: 110, y: 70 })).toBe(true);
  const rounded = { ...node, appearance: { shape: 'rounded-rectangle' as const } };
  expect(nodeShapeContainsPoint(rounded, { x: 10, y: 20 })).toBe(false);
  expect(nodeShapeBoundaryPoint(rounded, 'top', 0)).toEqual({ x: 10, y: 32 });
  for (const shape of ['rectangle', 'rounded-rectangle', 'cylinder'] as const) {
    const shaped = { ...node, appearance: { shape }, size: { width: 8, height: 5 } };
    const g = nodeShapeGeometry(shaped);
    expect(g.contentBounds.width).toBeGreaterThanOrEqual(0);
    expect(g.contentBounds.height).toBeGreaterThanOrEqual(0);
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      for (const offset of [0, 0.1, 0.5, 0.9, 1]) {
        const point = nodeShapeBoundaryPoint(shaped, side, offset);
        expect(nodeShapeContainsPoint(shaped, point)).toBe(true);
      }
    }
  }
});

test('opt-in shapes drive default port geometry and routing while explicit anchors remain authored', () => {
  const node: ZlozNode = {
    ...base(),
    appearance: { shape: 'cylinder' },
    ports: [
      { id: 'top', kind: 'output', side: 'top', offset: 0 },
      { id: 'custom', kind: 'output', side: 'top', anchor: { x: 0.25, y: 0.5 } },
    ],
  };
  expect(portPosition(node, 'top')).toEqual({ x: 10, y: 36 });
  expect(portBoundaryPosition(node, 'top')).toEqual({ x: 10, y: 36 });
  expect(portPosition(node, 'custom')).toEqual({ x: 60, y: 70 });
  expect(portBoundaryPosition(node, 'custom').x).toBe(60);
  expect(portBoundaryPosition(node, 'custom').y).toBeCloseTo(36 - 16 * Math.sqrt(0.75));
  const graph = {
    nodes: [
      node,
      {
        ...base(),
        id: 'b',
        position: { x: 400, y: 200 },
        ports: [{ id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 }],
      },
    ],
    edges: [
      { id: 'edge', source: { node: node.id, port: 'top' }, target: { node: 'b', port: 'in' } },
    ],
  };
  expect(edgePath(graph, graph.edges[0]!)).toBe('M10,36 L400,250');
  const resized = { ...node, size: { width: 400, height: 200 } };
  expect(portPosition(resized, 'custom')).toEqual({ x: 110, y: 120 });
  expect(portPosition(base(), 'out')).toEqual({ x: 210, y: 70 });
});

test('semantic and appearance edits are detached, policy-aware, undoable and invalidate stale layout', () => {
  const initial = createEditor(parseGraph(legacy));
  const request = layoutRequest(initial, 'before');
  const architecture: ZlozNodeArchitecture = { family: 'ddd', role: 'value-object' };
  const edited = updateEditor(initial, {
    type: 'NodeArchitectureChanged',
    id: 'old',
    architecture,
  });
  expect(edited.graph.nodes[0]?.architecture).toEqual(architecture);
  expect(edited.graph.nodes[0]?.architecture).not.toBe(architecture);
  expect(edited.past).toHaveLength(1);
  expect(edited.revision).toBe(initial.revision + 1);
  expect(updateEditor(edited, { type: 'NodeArchitectureChanged', id: 'old', architecture })).toBe(
    edited,
  );
  expect(
    applyLayout(edited, request, {
      requestId: request.requestId,
      revision: request.revision,
      positions: [],
      routes: [],
    }),
  ).toBe(edited);
  const changed = updateEditor(edited, {
    type: 'NodeAppearanceChanged',
    id: 'old',
    appearance: { shape: 'cylinder' },
  });
  expect(changed.past).toHaveLength(2);
  expect(changed.graph.nodes[0]?.ports).toEqual(edited.graph.nodes[0]?.ports);
  expect(changed.graph.nodes[0]?.architecture).toEqual(architecture);
  expect(updateEditor(changed, { type: 'UndoPressed' }).graph).toEqual(edited.graph);
  expect(
    updateEditor(updateEditor(changed, { type: 'UndoPressed' }), { type: 'RedoPressed' }).graph,
  ).toEqual(changed.graph);
  const cleared = updateEditor(changed, {
    type: 'NodeArchitectureChanged',
    id: 'old',
    architecture: null,
  });
  expect(cleared.graph.nodes[0]).not.toHaveProperty('architecture');
  expect(cleared.graph.nodes[0]?.data).toEqual(base().data);
  const blocked = updateEditor(
    initial,
    { type: 'NodeArchitectureChanged', id: 'old', architecture },
    { canChangeNodeArchitecture: () => 'Owned by another team' },
  );
  expect(blocked.graph).toBe(initial.graph);
  expect(blocked.past).toBe(initial.past);
  expect(blocked.notice).toBe('Owned by another team');
  const appearanceBlocked = updateEditor(
    initial,
    { type: 'NodeAppearanceChanged', id: 'old', appearance: { shape: 'cylinder' } },
    {
      canChangeNodeAppearance: (node, next, graph) => {
        expect(node).toBe(graph.nodes[0]!);
        expect(next.appearance).toEqual({ shape: 'cylinder' });
        return 'Keep this notation';
      },
    },
  );
  expect(appearanceBlocked.graph).toBe(initial.graph);
  expect(appearanceBlocked.past).toBe(initial.past);
  expect(appearanceBlocked.notice).toBe('Keep this notation');
  const noAppearance = updateEditor(changed, {
    type: 'NodeAppearanceChanged',
    id: 'old',
    appearance: null,
  });
  expect(noAppearance.graph.nodes[0]).not.toHaveProperty('appearance');
  expect(noAppearance.graph.nodes[0]?.architecture).toEqual(architecture);
  expect(updateEditor(noAppearance, { type: 'UndoPressed' }).graph).toEqual(changed.graph);
  const locked = { ...initial, readOnly: true };
  expect(
    updateEditor(locked, {
      type: 'NodeAppearanceChanged',
      id: 'old',
      appearance: { shape: 'cylinder' },
    }),
  ).toBe(locked);
  expect(() =>
    updateEditor(initial, {
      type: 'NodeArchitectureChanged',
      id: 'old',
      architecture: { family: 'ddd', role: 'aggregate' },
    }),
  ).toThrow();
  expect(initial.past).toHaveLength(0);
});

test('descriptor edits cancel pending connections and clear routes while active gestures block them', () => {
  const initial = {
    ...createEditor(parseGraph(legacy)),
    connection: { node: 'old', port: 'out' },
    routes: [
      {
        id: 'stale',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
      },
    ],
  };
  const event = {
    type: 'NodeAppearanceChanged',
    id: 'old',
    appearance: { shape: 'rounded-rectangle' },
  } as const;
  const changed = updateEditor(initial, event);
  expect(changed.connection).toBeNull();
  expect(changed.routes).toEqual([]);
  const dragging = updateEditor(initial, {
    type: 'NodeDragStarted',
    id: 'old',
    pointer: 1,
    point: { x: 10, y: 20 },
  });
  expect(updateEditor(dragging, event)).toBe(dragging);
  const architecture = {
    family: 'c4',
    role: 'container',
    description: 'Orders',
    technology: 'PostgreSQL',
  } as const;
  const described = updateEditor(changed, {
    type: 'NodeArchitectureChanged',
    id: 'old',
    architecture,
  });
  expect(
    updateEditor(described, {
      type: 'NodeArchitectureChanged',
      id: 'old',
      architecture: {
        technology: 'PostgreSQL',
        description: 'Orders',
        role: 'container',
        family: 'c4',
      },
    }),
  ).toBe(described);
});

test('anchor reset uses existing port policy and Undo without changing shape, data or semantics', () => {
  const graph = parseGraph(modern);
  const editor = createEditor(graph);
  const event = { type: 'PortAnchorReset', endpoint: { node: 'store', port: 'out' } } as const;
  const blocked = updateEditor(editor, event, { canEditPort: () => 'Keep authored anchor' });
  expect(blocked.graph).toBe(editor.graph);
  expect(blocked.notice).toBe('Keep authored anchor');
  const changed = updateEditor(editor, event);
  expect(changed.graph.nodes[0]?.ports[0]).toEqual({
    id: 'out',
    kind: 'output',
    side: 'right',
    offset: 0.5,
  });
  expect(changed.graph.nodes[0]?.architecture).toEqual(graph.nodes[0]?.architecture);
  expect(updateEditor(changed, { type: 'UndoPressed' }).graph).toEqual(graph);
});

test('keyboard anchor edits start at the curved default rather than its rectangular envelope', () => {
  const node: ZlozNode = {
    ...base(),
    appearance: { shape: 'cylinder' },
    ports: [{ id: 'out', kind: 'output', side: 'top', offset: 0 }],
  };
  const editor = createEditor({ nodes: [node], edges: [] });
  const changed = updateEditor(editor, {
    type: 'PortAnchorNudged',
    endpoint: { node: node.id, port: 'out' },
    delta: { x: 0.1, y: 0.1 },
  });
  expect(changed.graph.nodes[0]?.ports[0]?.anchor?.x).toBeCloseTo(0.1);
  expect(changed.graph.nodes[0]?.ports[0]?.anchor?.y).toBeCloseTo(0.26);
  expect(updateEditor(changed, { type: 'UndoPressed' }).graph).toEqual(editor.graph);
});
