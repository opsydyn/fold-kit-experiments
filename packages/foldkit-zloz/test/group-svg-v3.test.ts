import { expect, test } from 'bun:test';

import {
  captureGroupDocumentV3,
  createGroupWorkbenchV3,
  planGroupSvgExportV3,
  writeGroupSvgExportV3,
  captureGroupSvgLayoutV3,
  portPosition,
  writeSvgExport,
  type ZlozGroupSvgExportOptionsV3,
} from '../src/index';
import wire from './fixtures/group-document-v3-ported.json';
import { fontBytes } from './helpers/font-cmap';
const document = captureGroupDocumentV3(wire);
const options: ZlozGroupSvgExportOptionsV3 = {
  title: 'Native <& group',
  region: { type: 'model', padding: 40 },
  theme: { colorScheme: 'light' },
  background: { type: 'theme' },
  font: { family: 'sans-serif', size: 14, weight: 400 },
  renderers: { nodes: 'built-in', edges: 'built-in' },
};
test('native planning and writing retain full v3 source and group-port endpoints without touching history', () => {
  const workbench = createGroupWorkbenchV3(document, { sessionId: 'svg-v3' }),
    before = JSON.stringify(workbench);
  const plan = planGroupSvgExportV3(document, options),
    result = writeGroupSvgExportV3(document, options);
  expect(plan.version).toBe(3);
  expect(plan.document).toEqual(document);
  expect(plan.graph).toBe(plan.document.graph);
  expect(result.type).toBe('written');
  if (result.type !== 'written') throw new Error('Expected SVG');
  expect(result.svg).toContain('data-zloz-document-version="3"');
  expect(result.svg).toContain('data-zloz-connection-mode="strict"');
  expect(result.svg).toContain('data-zloz-group-ports="true"');
  expect(result.svg).toContain('data-zloz-export-port="out"');
  expect(result.svg).toContain('Native &lt;&amp; group');
  expect(JSON.stringify(workbench)).toBe(before);
  expect(() => writeSvgExport({ graph: document.graph }, options)).toThrow();
});
test('native retained route snapshots bind the entire document, renderer key and exact authored anchors', () => {
  const edge = document.graph.edges[0]!;
  const points = [edge.source, edge.target].map((endpoint) =>
    portPosition(document.graph.nodes.find((n) => n.id === endpoint.node)!, endpoint.port),
  );
  const snapshot = captureGroupSvgLayoutV3(document, [{ id: edge.id, points }], 'renderer-a');
  const configured = { ...options, layout: { snapshot, renderKey: 'renderer-a' } };
  expect(writeGroupSvgExportV3(document, configured).type).toBe('written');
  const changed = captureGroupDocumentV3({ ...document, connectionMode: 'loose' });
  const stale = writeGroupSvgExportV3(changed, configured);
  expect(stale.type).toBe('blocked');
  expect(stale.findings.some((f) => f.code === 'layout-stale')).toBe(true);
  expect(
    writeGroupSvgExportV3(document, {
      ...configured,
      layout: { snapshot, renderKey: 'renderer-b' },
    }).type,
  ).toBe('blocked');
  expect(() =>
    captureGroupSvgLayoutV3(
      document,
      [
        {
          id: edge.id,
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
      ],
      'wrong',
    ),
  ).toThrow();
});
test('native crops, palettes and loose mode preserve explicit source meaning without becoming a model codec', () => {
  const loose = captureGroupDocumentV3({ ...document, connectionMode: 'loose' });
  const result = writeGroupSvgExportV3(loose, {
    ...options,
    region: { type: 'viewport', size: { width: 800, height: 600 } },
    theme: { colorScheme: 'dark' },
    background: { type: 'transparent' },
  });
  expect(result.type).toBe('written');
  expect(result.plan.viewBox).toEqual({ x: -9.6, y: 3.2, width: 640, height: 480 });
  expect(result.plan.size).toEqual({ width: 800, height: 600 });
  expect(result.plan.background).toBeNull();
  expect(result.plan.theme.tokens.nodeBackground).toBe('#202b3e');
  if (result.type === 'written') {
    expect(result.svg).toContain('data-zloz-connection-mode="loose"');
    expect(result.svg).not.toContain('"coordinateSpace"');
    // Canonical group sockets paint above crossing edge artwork.
    expect(result.svg.indexOf('data-zloz-export-node-ports="g"')).toBeGreaterThan(
      result.svg.indexOf('data-zloz-export-edge="boundary-link"'),
    );
  }
  const empty = writeGroupSvgExportV3(
    captureGroupDocumentV3({
      ...document,
      capabilities: { groupPorts: false },
      graph: { nodes: [], edges: [] },
    }),
    options,
  );
  expect(empty.type).toBe('written');
  expect(empty.plan.contentBounds).toEqual({ x: 0, y: 0, width: 1, height: 1 });
});
test('native adapters receive immutable full source and geometry; unsafe or failed output never returns partial SVG', () => {
  const custom = {
    ...options,
    renderers: {
      ...options.renderers,
      overrides: [
        {
          target: { kind: 'node', id: 'g' },
          renderer: {
            type: 'svg',
            id: 'native-badge',
            version: '1',
            bounds: { x: 100, y: 80, width: 400, height: 300 },
            fidelity: 'equivalent',
            reason: 'Custom vector boundary with its authored socket.',
          },
        },
      ],
    },
  } as const;
  const written = writeGroupSvgExportV3(document, custom, {
    adapters: [
      {
        id: 'native-badge',
        version: '1',
        render: (context) => {
          expect(context.version).toBe(3);
          expect(context.document).toEqual(document);
          expect(Object.isFrozen(context.document.graph.nodes)).toBe(true);
          return [{ type: 'text', position: { x: 120, y: 100 }, text: 'Safe <script> & literal' }];
        },
      },
    ],
  });
  expect(written.type).toBe('written');
  if (written.type === 'written')
    expect(written.svg).toContain('Safe &lt;script&gt; &amp; literal');
  expect(writeGroupSvgExportV3(document, custom).type).toBe('blocked');
  const mutation = writeGroupSvgExportV3(document, custom, {
    adapters: [
      {
        id: 'native-badge',
        version: '1',
        render: (context) => {
          Object.assign(context.document.capabilities, { groupPorts: false });
          return [{ type: 'circle', center: { x: 0, y: 0 }, radius: 4 }];
        },
      },
    ],
  });
  expect(mutation.type).toBe('blocked');
  expect(mutation.findings.some((f) => f.code === 'adapter-failed')).toBe(true);
  expect('svg' in mutation).toBe(false);
  expect(writeGroupSvgExportV3(document, options, { maxPrimitives: 1 }).type).toBe('blocked');
  expect(writeGroupSvgExportV3(document, options, { maxCharacters: 10 }).type).toBe('blocked');
  expect(document.capabilities.groupPorts).toBe(true);
});
test('explicit native fallback/omission needs loss consent; unsupported resources and themes cannot be accepted away', () => {
  const omitted = {
    ...options,
    renderers: {
      ...options.renderers,
      overrides: [
        {
          target: { kind: 'node', id: 'g' },
          renderer: { type: 'omit', reason: 'Interactive boundary omitted.' },
        },
      ],
    },
  } as const;
  const blocked = writeGroupSvgExportV3(document, omitted);
  expect(blocked.type).toBe('blocked');
  expect(blocked.findings.map((f) => f.code)).toContain('omitted-endpoint');
  const allowed = writeGroupSvgExportV3(document, omitted, { allowLosses: true });
  expect(allowed.type).toBe('written');
  expect(allowed.findings.some((f) => f.code === 'renderer-omitted' && f.severity === 'loss')).toBe(
    true,
  );
  for (const configured of [
    { ...options, renderers: { nodes: 'unknown', edges: 'built-in' } },
    { ...options, assets: [{ id: 'remote', kind: 'stylesheet', availability: 'external' }] },
    {
      ...options,
      theme: { colorScheme: 'light', tokens: { edge: 'url(https://example.invalid/image)' } },
    },
  ] as const) {
    const result = writeGroupSvgExportV3(document, configured, { allowLosses: true });
    expect(result.type).toBe('blocked');
    expect('svg' in result).toBe(false);
  }
});
test('native layout capture owns routes, rejects accessors and binds camera/capability changes rather than just graph geometry', () => {
  const edge = document.graph.edges[0]!,
    points = [edge.source, edge.target].map((endpoint) =>
      portPosition(document.graph.nodes.find((n) => n.id === endpoint.node)!, endpoint.port),
    );
  const input = [{ id: edge.id, points }];
  const snapshot = captureGroupSvgLayoutV3(document, input, 'native');
  Object.assign(points[0]!, { x: 0 });
  expect(snapshot.routes[0]!.points[0]!.x).toBe(500);
  expect(Object.isFrozen(snapshot.routes[0]!.points)).toBe(true);
  const camera = captureGroupDocumentV3({ ...document, viewport: { x: 0, y: 0, zoom: 1 } });
  expect(
    writeGroupSvgExportV3(camera, { ...options, layout: { snapshot, renderKey: 'native' } }).type,
  ).toBe('blocked');
  let accessed = false;
  const getter = {
    id: edge.id,
    get points() {
      accessed = true;
      return snapshot.routes[0]!.points;
    },
  };
  expect(() => captureGroupSvgLayoutV3(document, [getter], 'native')).toThrow();
  expect(accessed).toBe(false);
  expect(() =>
    planGroupSvgExportV3(document, {
      ...options,
      layout: { renderKey: 'native', snapshot: { ...snapshot, source: 'forged' } },
    }),
  ).toThrow();
  // @ts-expect-error The native entry must refuse a legacy source even if its graph happens to look similar.
  expect(() => writeGroupSvgExportV3({ graph: document.graph }, options)).toThrow();
});
test('nested group bodies paint outer-first and native fonts use the same validated resource boundary', () => {
  const nested = captureGroupDocumentV3({
    ...document,
    graph: {
      ...document.graph,
      nodes: document.graph.nodes.map((n) =>
        n.id === 'child'
          ? {
              ...n,
              kind: 'group',
              ports: [{ id: 'nested-out', kind: 'output', side: 'right', offset: 0.5 }],
            }
          : n,
      ),
      edges: [
        ...document.graph.edges,
        {
          id: 'nested-edge',
          source: { node: 'child', port: 'nested-out' },
          target: { node: 'b', port: 'in' },
        },
      ],
    },
  });
  const embedded = {
    ...options,
    font: { family: 'Inter', size: 14, weight: 400, assetId: 'inter' },
    assets: [{ id: 'inter', kind: 'font', availability: 'embedded' }],
  } as const;
  const result = writeGroupSvgExportV3(nested, embedded, {
    fontResources: [{ assetId: 'inter', format: 'truetype', bytes: fontBytes }],
  });
  expect(result.type).toBe('written');
  if (result.type === 'written') {
    expect(result.svg).toContain('data-zloz-export-port="nested-out"');
    expect(result.svg.indexOf('data-zloz-export-node="g"')).toBeLessThan(
      result.svg.indexOf('data-zloz-export-node="child"'),
    );
    expect(result.svg).toContain('@font-face');
    expect(result.svg).toContain('data:font/ttf;base64,');
  }
  expect(result.plan.document.graph.edges).toEqual(nested.graph.edges);
  const invalid = writeGroupSvgExportV3(nested, embedded, {
    fontResources: [{ assetId: 'inter', format: 'truetype', bytes: new Uint8Array(4) }],
  });
  expect(invalid.type).toBe('blocked');
  expect('svg' in invalid).toBe(false);
});
