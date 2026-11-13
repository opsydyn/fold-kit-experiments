import { expect, test } from 'bun:test';

import {
  createEditor,
  applyLayout,
  applyPreviewLayout,
  layoutRequest,
  updateEditor,
  type ZlozGraph,
  type LayoutResult,
} from '../src/index';
const graph: ZlozGraph = {
  nodes: [
    {
      id: 'context',
      label: 'Context',
      kind: 'group',
      position: { x: 0, y: 0 },
      size: { width: 600, height: 300 },
      ports: [],
      architecture: { family: 'ddd', role: 'bounded-context' },
    },
    {
      id: 'event',
      label: 'Placed',
      parentId: 'context',
      position: { x: 20, y: 60 },
      size: { width: 180, height: 100 },
      ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
      architecture: { family: 'ddd', role: 'domain-event' },
      data: { source: 'event' },
    },
    {
      id: 'read',
      label: 'Orders',
      parentId: 'context',
      position: { x: 300, y: 60 },
      size: { width: 180, height: 100 },
      ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
      architecture: { family: 'ddd', role: 'read-model' },
      data: { source: 'view' },
    },
  ],
  edges: [
    {
      id: 'feed',
      source: { node: 'event', port: 'out' },
      target: { node: 'read', port: 'in' },
      label: 'feeds',
      architecture: { family: 'ddd', scope: 'tactical', role: 'feeds' },
      data: { source: 'relation' },
    },
  ],
};
function fixture(readOnly = true) {
  const editor = createEditor(graph, { readOnly }),
    active = layoutRequest(editor, 'preview:1');
  const result: LayoutResult = {
    requestId: active.requestId,
    revision: active.revision,
    positions: [
      { id: 'context', x: 10, y: 20, size: { width: 700, height: 400 } },
      { id: 'event', x: 50, y: 80 },
      { id: 'read', x: 450, y: 150 },
    ],
    routes: [
      {
        id: 'feed',
        points: [
          { x: 230, y: 130 },
          { x: 340, y: 130 },
          { x: 340, y: 200 },
          { x: 450, y: 200 },
        ],
      },
    ],
  };
  return { editor, active, result };
}
test('preview layout changes only geometry/routes, stays read-only and advances revision without changing Undo or source semantics', () => {
  const { editor, active, result } = fixture();
  const next = applyPreviewLayout(editor, active, result);
  expect(next.readOnly).toBe(true);
  expect(next.revision).toBe(editor.revision + 1);
  expect(next.past).toBe(editor.past);
  expect(next.future).toBe(editor.future);
  expect(next.graph.edges).toBe(editor.graph.edges);
  expect(next.graph.nodes.map(({ position, size, ...node }) => node)).toEqual(
    editor.graph.nodes.map(({ position, size, ...node }) => node),
  );
  expect(next.graph.nodes.find((n) => n.id === 'read')?.position).toEqual({ x: 450, y: 150 });
  expect(next.graph.nodes[0]?.size).toEqual({ width: 700, height: 400 });
  expect(next.routes).toEqual(result.routes);
  expect(next.routes).not.toBe(result.routes);
  expect(editor.graph).toEqual(graph);
  expect(applyPreviewLayout(next, active, result)).toBe(next);
  expect(applyLayout(editor, active, result)).toBe(editor);
  const editable = fixture(false),
    edited = applyLayout(editable.editor, editable.active, editable.result);
  expect(edited.past).toHaveLength(1);
  expect(applyPreviewLayout(editable.editor, editable.active, editable.result)).toBe(
    editable.editor,
  );
});
test('stale request, revision and active gestures cannot apply a preview result', () => {
  const { editor, active, result } = fixture();
  for (const value of [
    { ...result, requestId: 'old' },
    { ...result, revision: 99 },
  ])
    expect(applyPreviewLayout(editor, active, value)).toBe(editor);
  const pan = updateEditor(editor, { type: 'PanStarted', pointer: 1, point: { x: 0, y: 0 } });
  expect(applyPreviewLayout(pan, active, result)).toBe(pan);
});
test('invalid preview geometry/routes fail atomically through the same layout validator as editing', () => {
  const { editor, active, result } = fixture();
  const cases: LayoutResult[] = [
    { ...result, positions: result.positions.slice(1) },
    { ...result, positions: [...result.positions, result.positions[0] ?? { id: 'x', x: 0, y: 0 }] },
    {
      ...result,
      positions: result.positions.map((p) => (p.id === 'read' ? { ...p, x: Infinity } : p)),
    },
    {
      ...result,
      positions: result.positions.map((p) =>
        p.id === 'read' ? { ...p, size: { width: 1, height: 1 } } : p,
      ),
    },
    {
      ...result,
      positions: result.positions.map((p) =>
        p.id === 'context' ? { ...p, size: { width: -1, height: 1 } } : p,
      ),
    },
    {
      ...result,
      routes: [
        {
          id: 'missing',
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
      ],
    },
    { ...result, routes: [{ id: 'feed', points: [{ x: 0, y: 0 }] }] },
    {
      ...result,
      routes: [
        {
          id: 'feed',
          points: [
            { x: NaN, y: 0 },
            { x: 1, y: 1 },
          ],
        },
      ],
    },
  ];
  for (const bad of cases) {
    expect(() => applyPreviewLayout(editor, active, bad)).toThrow();
    expect(editor.graph).toEqual(graph);
    expect(editor.past).toHaveLength(0);
  }
});
