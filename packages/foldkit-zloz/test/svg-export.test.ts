import { expect, test } from 'bun:test';

import {
  planSvgExport,
  captureSvgLayout,
  serializeGraph,
  writeSvgExport,
  createEditor,
  type ZlozSvgExportOptions,
  type ZlozGraph,
} from '../src/index';
const graph: ZlozGraph = {
  nodes: [
    {
      id: 'group',
      kind: 'group',
      label: 'Boundary',
      position: { x: 0, y: 0 },
      size: { width: 300, height: 250 },
      ports: [],
    },
    {
      id: 'a',
      parentId: 'group',
      label: 'A <& "',
      position: { x: 20, y: 30 },
      size: { width: 80, height: 60 },
      ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
    },
    {
      id: 'b',
      label: 'B',
      position: { x: 180, y: 120 },
      size: { width: 80, height: 60 },
      ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
    },
  ],
  edges: [
    {
      id: 'ab',
      label: 'Calls',
      source: { node: 'a', port: 'out' },
      target: { node: 'b', port: 'in' },
      waypoints: [{ id: 'bend', position: { x: -40, y: -80 } }],
    },
  ],
};
const options: ZlozSvgExportOptions = {
  title: 'System composition',
  region: { type: 'model', padding: 10 },
  theme: { colorScheme: 'light' },
  background: { type: 'theme' },
  font: { family: 'Inter', size: 14, weight: 400 },
  renderers: { nodes: 'built-in', edges: 'built-in' },
  scale: 2,
};
test('whole-model plan includes nested envelopes and authored bends, with explicit portable output and fidelity', () => {
  const editor = createEditor(graph);
  const plan = planSvgExport(editor, options);
  expect(plan.type).toBe('reviewable');
  expect(plan.contentBounds).toEqual({ x: -40, y: -80, width: 340, height: 330 });
  expect(plan.viewBox).toEqual({ x: -50, y: -90, width: 360, height: 350 });
  expect(plan.size).toEqual({ width: 720, height: 700 });
  expect(plan.background).toBe('#eef2f6');
  expect(plan.clip).toBe(true);
  expect(plan.findings.map((f) => f.code)).toContain('bounds-estimated');
  expect(plan.findings.map((f) => f.code)).toContain('font-unverified');
  expect(editor.past).toEqual([]);
  expect(editor.graph).toEqual(graph);
  Object.assign(plan.graph.nodes[0]?.position ?? {}, { x: 999 });
  expect(editor.graph.nodes[0]?.position.x).toBe(0);
});
test('viewport means a camera crop, keeping off-screen content for crossing edges; explicit bounds and transparency are independent', () => {
  const plan = planSvgExport(
    { graph, viewport: { x: 100, y: -50, zoom: 2 } },
    {
      ...options,
      region: { type: 'viewport', size: { width: 800, height: 600 } },
      scale: 1,
      background: { type: 'transparent' },
      theme: { colorScheme: 'dark' },
    },
  );
  expect(plan.viewBox).toEqual({ x: -50, y: 25, width: 400, height: 300 });
  expect(plan.size).toEqual({ width: 800, height: 600 });
  expect(plan.graph.nodes).toHaveLength(3);
  expect(plan.background).toBeNull();
  expect(plan.theme.tokens.nodeBackground).toBe('#202b3e');
  const crop = planSvgExport(
    { graph },
    {
      ...options,
      region: { type: 'bounds', bounds: { x: -20, y: 10, width: 50, height: 40 } },
      background: { type: 'color', value: '#123456' },
    },
  );
  expect(crop.viewBox).toEqual({ x: -20, y: 10, width: 50, height: 40 });
  expect(crop.size).toEqual({ width: 100, height: 80 });
  expect(crop.background).toBe('#123456');
});

test('renderer coverage blocks unknown custom content and records fallback, omission and declared SVG fidelity per item', () => {
  const unknown = planSvgExport(
    { graph },
    { ...options, renderers: { nodes: 'unknown', edges: 'unknown' } },
  );
  expect(unknown.type).toBe('blocked');
  expect(
    unknown.findings.filter((f) => f.code === 'renderer-unsupported').map((f) => f.target),
  ).toEqual([
    { kind: 'edge', id: 'ab' },
    { kind: 'node', id: 'a' },
    { kind: 'node', id: 'b' },
    { kind: 'node', id: 'group' },
  ]);
  const declaration = {
    type: 'svg',
    id: 'orbit',
    version: '2',
    bounds: { x: -100, y: -100, width: 500, height: 400 },
    fidelity: 'equivalent',
    reason: 'Host supplies vector adapter',
  } as const;
  const overrides = [
    { target: { kind: 'node', id: 'a' }, renderer: declaration },
    {
      target: { kind: 'node', id: 'b' },
      renderer: { type: 'omit', reason: 'Interactive HTML control intentionally omitted' },
    },
    {
      target: { kind: 'edge', id: 'ab' },
      renderer: { type: 'fallback', reason: 'Custom badge becomes plain text' },
    },
  ] as const;
  const plan = planSvgExport(
    { graph },
    { ...options, renderers: { nodes: 'built-in', edges: 'built-in', overrides } },
  );
  expect(plan.type).toBe('reviewable');
  expect(plan.contentBounds).toEqual({ x: -100, y: -100, width: 500, height: 400 });
  expect(
    plan.findings.some((f) => f.code === 'renderer-unverified' && f.reason.includes('orbit@2')),
  ).toBe(true);
  expect(plan.findings.filter((f) => f.severity === 'loss').map((f) => f.code)).toEqual([
    'omitted-endpoint',
    'renderer-fallback',
    'renderer-omitted',
  ]);
  expect(plan.items.find((i) => i.target.id === 'a')?.renderer).toEqual(declaration);
  const custom = plan.items.find((i) => i.target.id === 'a')?.renderer;
  if (!custom || custom.type !== 'svg') throw new Error('Expected detached SVG declaration');
  Object.assign(custom.bounds, { x: 999 });
  expect(declaration.bounds.x).toBe(-100);
  const approximate = planSvgExport(
    { graph },
    {
      ...options,
      renderers: {
        nodes: 'built-in',
        edges: 'built-in',
        overrides: [
          {
            target: { kind: 'node', id: 'a' },
            renderer: { ...declaration, fidelity: 'approximate', reason: 'HTML shadow is lost' },
          },
        ],
      },
    },
  );
  expect(approximate.findings.find((f) => f.code === 'renderer-approximate')?.severity).toBe(
    'loss',
  );
});
test('theme resolution is explicit and portable; unresolved CSS/paint or stroke width blocks without inventing a replacement', () => {
  const plan = planSvgExport(
    { graph },
    { ...options, theme: { colorScheme: 'dark', tokens: { nodeColor: '#123', edgeWidth: '4' } } },
  );
  expect(plan.theme.tokens.nodeColor).toBe('#123');
  expect(plan.theme.edgeWidth).toBe(4);
  expect(Object.keys(plan.theme.tokens)).not.toContain('controlColor');
  const unresolved = planSvgExport(
    { graph },
    {
      ...options,
      theme: {
        colorScheme: 'light',
        tokens: { nodeColor: 'var(--brand)', edgeWidth: 'var(--line)' },
      },
    },
  );
  expect(unresolved.type).toBe('blocked');
  expect(unresolved.theme.tokens.nodeColor).toBe('var(--brand)');
  expect(unresolved.theme.edgeWidth).toBeNull();
  expect(
    unresolved.findings.filter((f) => f.code === 'theme-unresolved').map((f) => f.target),
  ).toEqual([
    { kind: 'theme', id: 'edgeWidth' },
    { kind: 'theme', id: 'nodeColor' },
  ]);
  expect(
    planSvgExport(
      { graph },
      {
        ...options,
        background: { type: 'color', value: 'url(https://example.invalid/image.svg)' },
      },
    ).type,
  ).toBe('blocked');
});
test('assets are declarations, never fetched; external/missing resources block and embedded resources remain unverified', () => {
  const assets = [
    { id: 'brand', kind: 'image', availability: 'external' },
    { id: 'font', kind: 'font', availability: 'embedded' },
    { id: 'css', kind: 'stylesheet', availability: 'missing' },
  ] as const;
  const plan = planSvgExport(
    { graph },
    { ...options, assets, font: { ...options.font, assetId: 'font' } },
  );
  expect(plan.type).toBe('blocked');
  expect(plan.findings.filter((f) => f.code === 'asset-unavailable').map((f) => f.target)).toEqual([
    { kind: 'asset', id: 'brand' },
    { kind: 'asset', id: 'css' },
  ]);
  expect(plan.findings.find((f) => f.code === 'asset-unverified')?.severity).toBe('unverified');
  expect(plan.findings.find((f) => f.code === 'font-unverified')?.reason).toContain(
    'glyph coverage',
  );
  Object.assign(plan.assets[0] ?? {}, { availability: 'embedded' });
  expect(assets[0].availability).toBe('external');
  expect(() =>
    planSvgExport({ graph }, { ...options, font: { ...options.font, assetId: 'absent' } }),
  ).toThrow();
  expect(() => planSvgExport({ graph }, { ...options, assets: [assets[0], assets[0]] })).toThrow();
});
test('invalid numeric regions, absent camera, conflicting manifests and invalid fonts reject before producing a plan', () => {
  const invalid: ZlozSvgExportOptions[] = [
    { ...options, scale: 0 },
    { ...options, scale: Infinity },
    { ...options, title: ' ' },
    { ...options, region: { type: 'model', padding: -1 } },
    { ...options, region: { type: 'bounds', bounds: { x: NaN, y: 0, width: 1, height: 1 } } },
    { ...options, region: { type: 'bounds', bounds: { x: 0, y: 0, width: 0, height: 1 } } },
    { ...options, region: { type: 'viewport', size: { width: 800, height: 600 } } },
    { ...options, font: { ...options.font, size: 0 } },
    { ...options, font: { ...options.font, weight: 1001 } },
  ];
  for (const entry of invalid) expect(() => planSvgExport({ graph }, entry)).toThrow();
  expect(() => planSvgExport({ graph, viewport: { x: 0, y: 0, zoom: 0 } }, options)).toThrow();
  const override = { target: { kind: 'node', id: 'a' }, renderer: { type: 'built-in' } } as const;
  expect(() =>
    planSvgExport(
      { graph },
      {
        ...options,
        renderers: { nodes: 'built-in', edges: 'built-in', overrides: [override, override] },
      },
    ),
  ).toThrow();
  expect(() =>
    planSvgExport(
      { graph },
      {
        ...options,
        renderers: {
          nodes: 'built-in',
          edges: 'built-in',
          overrides: [{ ...override, target: { kind: 'node', id: 'absent' } }],
        },
      },
    ),
  ).toThrow();
  expect(() =>
    planSvgExport(
      { graph },
      {
        ...options,
        region: {
          type: 'bounds',
          bounds: { x: Number.MAX_VALUE, y: 0, width: Number.MAX_VALUE, height: 1 },
        },
      },
    ),
  ).toThrow();
});
test('empty models have a finite artboard; plans preserve literal text and stable findings without touching camera/history', () => {
  const plan = planSvgExport(
    { graph: { nodes: [], edges: [] } },
    { ...options, region: { type: 'model', padding: 0 } },
  );
  expect(plan.viewBox).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  expect(plan.size).toEqual({ width: 2, height: 2 });
  expect(plan.findings).toEqual([]);
  const editor = createEditor(graph, { viewport: { x: 50, y: 60, zoom: 2 } });
  const before = JSON.stringify(editor);
  const one = planSvgExport(editor, options);
  const two = planSvgExport(
    { ...editor, graph: { nodes: [...graph.nodes].reverse(), edges: graph.edges } },
    options,
  );
  expect(one.findings).toEqual(two.findings);
  expect(one.graph.nodes[1]?.label).toBe('A <& "');
  expect(JSON.stringify(editor)).toBe(before);
  expect(one.graph).not.toBe(editor.graph);
  expect(one.graph.edges).not.toBe(editor.graph.edges);
});

const routedEditor = () => ({
  ...createEditor(graph),
  routes: [
    {
      id: 'ab',
      points: [
        { x: -200, y: 40 },
        { x: 500, y: 40 },
      ],
      label: { position: { x: 420, y: -200 }, size: { width: 160, height: 30 } },
    },
  ],
});
const routedOptions = (editor = routedEditor()): ZlozSvgExportOptions => ({
  ...options,
  layout: { snapshot: captureSvgLayout(editor, 'labels-v1'), renderKey: 'labels-v1' },
});
test('layout export is opt-in, detached and bound to exact source and renderer configuration', () => {
  const editor = routedEditor();
  // Authored bends take precedence over retained routes, just as on the canvas.
  const authored = planSvgExport(editor, routedOptions(editor));
  expect(authored.contentBounds).toEqual({ x: -40, y: -80, width: 340, height: 330 });
  expect(authored.findings.some((f) => f.code === 'layout-route-overridden')).toBe(true);
  const plain = {
    ...editor,
    graph: { ...graph, edges: graph.edges.map(({ waypoints: _waypoints, ...edge }) => edge) },
  };
  const before = JSON.stringify(plain);
  const captured = captureSvgLayout(plain, 'labels-v1');
  expect(captured.source).toBe(serializeGraph(plain.graph));
  const plan = planSvgExport(plain, {
    ...options,
    layout: { snapshot: captured, renderKey: 'labels-v1' },
  });
  expect(plan.contentBounds).toEqual({ x: -200, y: -215, width: 700, height: 465 });
  expect(plan.viewBox).toEqual({ x: -210, y: -225, width: 720, height: 485 });
  expect(plan.layout?.routes[0]?.label?.position).toEqual({ x: 420, y: -200 });
  expect(plan.findings.find((f) => f.code === 'layout-label-content-unverified')?.target).toEqual({
    kind: 'edge',
    id: 'ab',
  });
  Object.assign(captured.routes[0]?.points[0] ?? {}, { x: 900 });
  expect(plan.layout?.routes[0]?.points[0]?.x).toBe(-200);
  expect(JSON.stringify(plain)).toBe(before);
  expect(planSvgExport(plain, options).layout).toBeUndefined();
});
test('stale graph or render keys block layout without using old geometry', () => {
  const editor = routedEditor(),
    configured = routedOptions(editor);
  const changed = {
    ...editor,
    graph: { ...graph, nodes: graph.nodes.map((n) => ({ ...n, label: n.label + ' changed' })) },
  };
  for (const [source, settings] of [
    [changed, configured],
    [editor, { ...configured, layout: { ...configured.layout!, renderKey: 'labels-v2' } }],
  ] as const) {
    const plan = planSvgExport(source, settings);
    expect(plan.type).toBe('blocked');
    expect(plan.layout).toBeUndefined();
    expect(plan.findings.find((f) => f.code === 'layout-stale')?.severity).toBe('unsupported');
  }
});
test('invalid routes and label envelopes reject atomically at capture and plan boundaries', () => {
  const editor = routedEditor();
  const route = editor.routes[0]!;
  const invalid = [
    [route, route],
    [{ ...route, id: 'missing' }],
    [{ ...route, points: [{ x: 0, y: 0 }] }],
    [
      {
        ...route,
        points: [
          { x: Infinity, y: 0 },
          { x: 0, y: 0 },
        ],
      },
    ],
    [{ ...route, label: { ...route.label, size: { width: 0, height: 1 } } }],
    [
      {
        ...route,
        label: {
          position: { x: Number.MAX_VALUE, y: 0 },
          size: { width: Number.MAX_VALUE, height: 1 },
        },
      },
    ],
  ];
  for (const routes of invalid) {
    expect(() => captureSvgLayout({ ...editor, routes }, 'labels-v1')).toThrow();
    expect(() =>
      planSvgExport(editor, {
        ...options,
        layout: {
          snapshot: { source: serializeGraph(graph), renderKey: 'labels-v1', routes },
          renderKey: 'labels-v1',
        },
      }),
    ).toThrow();
  }
  expect(() => captureSvgLayout(editor, ' ')).toThrow();
});
test('retained geometry writes explicitly without changing canonical defaults', () => {
  const editor = routedEditor();
  const result = writeSvgExport(editor, routedOptions(editor), { allowLosses: true });
  expect(result.type).toBe('written');
  expect(result.findings.some((f) => f.code === 'layout-route-overridden')).toBe(true);
  expect(writeSvgExport(editor, options, { allowLosses: true }).type).toBe('written');
});

test('explicit crops stay fixed; authored styles and custom vector bounds own precedence', () => {
  const editor = routedEditor();
  const styled = {
    ...editor,
    graph: {
      ...graph,
      edges: graph.edges.map(({ waypoints: _waypoints, ...edge }) => ({
        ...edge,
        pathStyle: 'straight' as const,
      })),
    },
  };
  const plan = planSvgExport(styled, {
    ...options,
    layout: { snapshot: captureSvgLayout(styled, 'v1'), renderKey: 'v1' },
  });
  expect(plan.contentBounds).toEqual({ x: 0, y: 0, width: 300, height: 250 });
  const cropped = planSvgExport(editor, {
    ...routedOptions(editor),
    region: { type: 'bounds', bounds: { x: 1, y: 2, width: 3, height: 4 } },
  });
  expect(cropped.viewBox).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  const plain = {
    ...editor,
    graph: { ...graph, edges: graph.edges.map(({ waypoints: _waypoints, ...edge }) => edge) },
  };
  for (const renderer of [
    { type: 'omit', reason: 'Badge omitted' },
    {
      type: 'svg',
      id: 'custom',
      version: '1',
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      fidelity: 'equivalent',
      reason: 'Own vector bounds',
    },
  ] as const) {
    const custom = planSvgExport(plain, {
      ...options,
      layout: { snapshot: captureSvgLayout(plain, 'v1'), renderKey: 'v1' },
      renderers: {
        ...options.renderers,
        overrides: [{ target: { kind: 'edge', id: 'ab' }, renderer }],
      },
    });
    expect(custom.contentBounds).toEqual({ x: 0, y: 0, width: 300, height: 250 });
  }
  expect(captureSvgLayout({ ...editor, routes: [] }, 'v1').routes).toEqual([]);
  expect(() =>
    captureSvgLayout({ ...editor, edgeLabelDraft: { id: 'ab', text: 'editing' } }, 'v1'),
  ).toThrow();
});
