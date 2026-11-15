import { expect, test } from 'bun:test';
import { strict as assert } from 'node:assert';

import {
  createEditor,
  layoutRequest,
  applyPreviewLayout,
  applyLayout,
  resolveEdgeGeometry,
  updateEditor,
  validateLayoutRequest,
  type LayoutResult,
  type ZlozGraph,
} from '../src/index';
import { viewportItems } from '../src/viewport-culling';
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
      position: { x: 400, y: 0 },
      size: { width: 100, height: 80 },
      ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
    },
  ],
  edges: [
    {
      id: 'ab',
      source: { node: 'a', port: 'out' },
      target: { node: 'b', port: 'in' },
      label: 'Composite badge',
    },
  ],
};
const size = { width: 176, height: 36 };
test('layout label hints are explicit, validated and detached; legacy request shape remains unchanged', () => {
  const state = createEditor(graph, { readOnly: true });
  const labels = [{ id: 'ab', size: { ...size } }];
  const request = layoutRequest(state, 'label:1', { edgeLabels: labels });
  expect(request.edgeLabels).toEqual(labels);
  expect(request.edgeLabels).not.toBe(labels);
  assert(labels[0]);
  labels[0].size.width = 1;
  expect(request.edgeLabels?.[0]?.size.width).toBe(176);
  expect('edgeLabels' in layoutRequest(state, 'legacy')).toBe(false);
  for (const edgeLabels of [
    [{ id: 'missing', size }],
    [
      { id: 'ab', size },
      { id: 'ab', size },
    ],
    [{ id: 'ab', size: { width: 0, height: 36 } }],
    [{ id: 'ab', size: { width: 176, height: Infinity } }],
  ])
    expect(() => validateLayoutRequest({ ...request, edgeLabels })).toThrow();
});
test('positioned label boxes survive publication and drive geometry anchors without mutating graph or Undo', () => {
  const state = createEditor(graph, { readOnly: true }),
    request = layoutRequest(state, 'label:1', { edgeLabels: [{ id: 'ab', size }] });
  const result: LayoutResult = {
    requestId: request.requestId,
    revision: request.revision,
    positions: graph.nodes.map((n) => ({ id: n.id, ...n.position })),
    routes: [
      {
        id: 'ab',
        points: [
          { x: 100, y: 40 },
          { x: 400, y: 40 },
        ],
        label: { position: { x: 250, y: 90 }, size },
      },
    ],
  };
  const next = applyPreviewLayout(state, request, result),
    route = next.routes[0];
  expect(route?.label).toEqual(result.routes[0]?.label);
  expect(route?.label).not.toBe(result.routes[0]?.label);
  expect(next.past).toBe(state.past);
  expect(next.graph.edges).toBe(state.graph.edges);
  const edge = graph.edges[0];
  assert(edge);
  expect(
    resolveEdgeGeometry(next.graph, edge, {
      route: route?.points,
      labelPosition: route?.label?.position,
    }).labelPosition,
  ).toEqual({ x: 250, y: 90 });
  expect(
    resolveEdgeGeometry(
      next.graph,
      { ...edge, pathStyle: 'straight' },
      { route: route?.points, labelPosition: route?.label?.position },
    ).labelPosition,
  ).toEqual({ x: 250, y: 40 });
  const override = resolveEdgeGeometry(next.graph, edge, {
    route: route?.points,
    labelPosition: route?.label?.position,
    policy: () => ({ path: 'M0,0 L1,1', labelPosition: { x: 7, y: 8 } }),
  });
  expect(override.labelPosition).toEqual({ x: 7, y: 8 });
  for (const label of [
    undefined,
    { position: { x: NaN, y: 90 }, size },
    { position: { x: 250, y: 90 }, size: { width: 175, height: 36 } },
  ]) {
    const bad = {
      ...result,
      routes: result.routes.map((r) => (label ? { ...r, label } : { id: r.id, points: r.points })),
    };
    expect(() => applyPreviewLayout(state, request, bad)).toThrow();
  }
  expect(() => applyPreviewLayout(state, request, { ...result, routes: [] })).toThrow();
  expect(() => applyPreviewLayout(state, layoutRequest(state, 'label:1'), result)).toThrow();
  expect(applyPreviewLayout({ ...state, revision: 1 }, request, { ...result, routes: [] })).toEqual(
    { ...state, revision: 1 },
  );
  assert(result.routes[0]);
  const fit = updateEditor(
    {
      ...next,
      routes: [{ ...result.routes[0], label: { position: { x: 2000, y: 2000 }, size } }],
      surface: { width: 800, height: 600 },
    },
    { type: 'FitViewClicked' },
  );
  expect(fit.viewport.zoom).toBeLessThan(0.5);
});

test('label envelopes retain unlabeled custom badges during culling and writable layout remains one Undo', () => {
  const state = createEditor(graph),
    request = layoutRequest(state, 'label-edit', { edgeLabels: [{ id: 'ab', size }] });
  const result: LayoutResult = {
    requestId: request.requestId,
    revision: request.revision,
    positions: graph.nodes.map((n) => ({
      id: n.id,
      x: n.position.x + 1000,
      y: n.position.y + 1000,
    })),
    routes: [
      {
        id: 'ab',
        points: [
          { x: 1100, y: 1040 },
          { x: 1400, y: 1040 },
        ],
        label: { position: { x: 50, y: 50 }, size },
      },
    ],
  };
  const next = applyLayout(state, request, result);
  expect(next.past).toHaveLength(1);
  expect(updateEditor(next, { type: 'UndoPressed' }).graph).toEqual(state.graph);
  const presentation = {
    nodes: next.graph.nodes,
    edges: next.graph.edges.map((e) => ({ ...e, label: undefined })),
    hiddenBy: new Map(),
  };
  const culled = viewportItems(
    { ...next, surface: { width: 200, height: 150 }, viewport: { x: 0, y: 0, zoom: 1 } },
    presentation,
    new Map(next.routes.map((r) => [r.id, r])),
    false,
    { overscan: 0 },
  );
  expect(culled.nodes).toHaveLength(0);
  expect(culled.edges.map((e) => e.id)).toEqual(['ab']);
});
