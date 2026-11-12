import { expect, test } from 'bun:test';

import {
  writeSvgExport,
  createEditor,
  type ZlozSvgExportOptions,
  type ZlozSvgPrimitive,
} from '../src/index';
import { parseGraph } from '../src/index';
import fixture from './fixtures/waypoints-v1.json';
const graph = parseGraph(JSON.stringify(fixture));
const options: ZlozSvgExportOptions = {
  title: 'System <& "review"',
  description: 'A → B',
  region: { type: 'model', padding: 80 },
  theme: { colorScheme: 'light' },
  background: { type: 'theme' },
  font: { family: 'sans-serif', size: 14, weight: 400 },
  renderers: { nodes: 'built-in', edges: 'built-in' },
};
test('writer emits escaped standalone SVG with canonical paths, ports, labels, explicit clipping and unchanged editor', () => {
  const editor = createEditor(graph);
  const before = JSON.stringify(editor);
  const result = writeSvgExport(editor, options);
  expect(result.type).toBe('written');
  if (result.type !== 'written') throw new Error('Expected SVG');
  expect(result.svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg"');
  expect(result.svg).toContain('System &lt;&amp; &quot;review&quot;');
  expect(result.svg).toContain('role="img"');
  expect(result.svg).toContain('<clipPath');
  expect(result.svg).toContain('data-zloz-export-node=');
  expect(result.svg).toContain('data-zloz-export-port=');
  expect(result.svg).toContain('marker-end="url(#zloz-export-arrow)"');
  expect(result.svg).not.toContain('foreignObject');
  expect(result.svg).not.toContain('<script');
  expect(result.findings.some((f) => f.code === 'font-unverified')).toBe(true);
  expect(JSON.stringify(editor)).toBe(before);
});
test('missing custom bindings block without partial markup; explicit matching adapter emits safe primitives', () => {
  const id = graph.nodes[0]?.id;
  if (!id) throw new Error('Expected node');
  const custom = {
    ...options,
    renderers: {
      ...options.renderers,
      overrides: [
        {
          target: { kind: 'node', id },
          renderer: {
            type: 'svg',
            id: 'badge',
            version: '1',
            bounds: { x: 0, y: 0, width: 1000, height: 1000 },
            fidelity: 'equivalent',
            reason: 'Static badge adapter',
          },
        },
      ],
    },
  } as const;
  const missing = writeSvgExport({ graph }, custom);
  expect(missing.type).toBe('blocked');
  expect('svg' in missing).toBe(false);
  const result = writeSvgExport({ graph }, custom, {
    adapters: [
      {
        id: 'badge',
        version: '1',
        render: (context) => [
          {
            type: 'text',
            position: context.kind === 'node' ? context.node.position : { x: 0, y: 0 },
            text: 'Badge <script> & literal',
          },
        ],
      },
    ],
  });
  expect(result.type).toBe('written');
  if (result.type === 'written') expect(result.svg).toContain('Badge &lt;script&gt; &amp; literal');
  expect(result.findings.some((f) => f.code === 'renderer-unverified')).toBe(true);
});

test('losses require explicit acknowledgement; resources and unknown renderers never silently fall back', () => {
  const id = graph.nodes[0]?.id;
  if (!id) throw new Error('Expected node');
  const omitted = {
    ...options,
    renderers: {
      ...options.renderers,
      overrides: [
        {
          target: { kind: 'node', id },
          renderer: { type: 'omit', reason: 'HTML controls omitted' },
        },
      ],
    },
  } as const;
  expect(writeSvgExport({ graph }, omitted).type).toBe('blocked');
  const allowed = writeSvgExport({ graph }, omitted, { allowLosses: true });
  expect(allowed.type).toBe('written');
  if (allowed.type === 'written')
    expect(allowed.svg).not.toContain(`data-zloz-export-node="${id}"`);
  expect(allowed.findings.some((f) => f.code === 'renderer-omitted' && f.severity === 'loss')).toBe(
    true,
  );
  expect(
    writeSvgExport({ graph }, { ...options, renderers: { nodes: 'unknown', edges: 'unknown' } })
      .type,
  ).toBe('blocked');
  const asset = writeSvgExport(
    { graph },
    {
      ...options,
      assets: [{ id: 'font', kind: 'font', availability: 'embedded' }],
      font: { ...options.font, assetId: 'font' },
    },
  );
  expect(asset.type).toBe('blocked');
  expect(asset.findings.some((f) => f.code === 'resource-unsupported')).toBe(true);
});

test('custom failures, context mutation and unrepresentable XML block atomically, preserving caller inputs', () => {
  const id = graph.nodes[0]?.id;
  if (!id) throw new Error('Expected node');
  const input = {
    ...options,
    renderers: {
      ...options.renderers,
      overrides: [
        {
          target: { kind: 'node', id },
          renderer: {
            type: 'svg',
            id: 'custom',
            version: '1',
            bounds: { x: 0, y: 0, width: 100, height: 100 },
            fidelity: 'equivalent',
            reason: 'Test vector',
          },
        },
      ],
    },
  } as const;
  const before = JSON.stringify(graph);
  const mutation = writeSvgExport({ graph }, input, {
    adapters: [
      {
        id: 'custom',
        version: '1',
        render: (context) => {
          Object.assign(context.theme.tokens, { edge: '#000' });
          return [];
        },
      },
    ],
  });
  expect(mutation.type).toBe('blocked');
  expect('svg' in mutation).toBe(false);
  expect(JSON.stringify(graph)).toBe(before);
  const thrown = writeSvgExport({ graph }, input, {
    adapters: [
      {
        id: 'custom',
        version: '1',
        render: () => {
          throw new Error('Adapter failed');
        },
      },
    ],
  });
  expect(thrown.type).toBe('blocked');
  expect(thrown.findings.at(-1)?.code).toBe('adapter-failed');
  expect(
    writeSvgExport({ graph }, input, {
      adapters: [{ id: 'custom', version: '1', render: () => [] }],
    }).type,
  ).toBe('blocked');
  for (const text of ['Bad\u0000text', 'Bad\ud800text']) {
    const result = writeSvgExport({ graph }, { ...options, title: text });
    expect(result.type).toBe('blocked');
    expect('svg' in result).toBe(false);
  }
  const unicode = writeSvgExport({ graph }, { ...options, title: 'Zloz 🧩 — Ζ' });
  expect(unicode.type).toBe('written');
});

test('adapter output rejects URLs, injected fields, invalid geometry, recursion and size budgets', () => {
  const id = graph.nodes[0]?.id;
  if (!id) throw new Error('Expected node');
  const input = {
    ...options,
    renderers: {
      ...options.renderers,
      overrides: [
        {
          target: { kind: 'node', id },
          renderer: {
            type: 'svg',
            id: 'custom',
            version: '1',
            bounds: { x: 0, y: 0, width: 100, height: 100 },
            fidelity: 'equivalent',
            reason: 'Test vector',
          },
        },
      ],
    },
  } as const;
  for (const fill of [
    'url(https://example.invalid/a.svg)',
    'var(--paint)',
    '#fff" onload="alert(1)',
  ]) {
    const result = writeSvgExport({ graph }, input, {
      adapters: [
        {
          id: 'custom',
          version: '1',
          render: () => [{ type: 'rect', position: { x: 0, y: 0 }, width: 40, height: 40, fill }],
        },
      ],
    });
    expect(result.type).toBe('blocked');
    expect('svg' in result).toBe(false);
  }
  const invalid = writeSvgExport({ graph }, input, {
    adapters: [
      {
        id: 'custom',
        version: '1',
        render: () => [{ type: 'circle', center: { x: Infinity, y: 0 }, radius: 10 }],
      },
    ],
  });
  expect(invalid.type).toBe('blocked');
  const nested = writeSvgExport({ graph }, input, {
    maxDepth: 1,
    adapters: [
      {
        id: 'custom',
        version: '1',
        render: () => [
          {
            type: 'group',
            children: [
              {
                type: 'group',
                children: [{ type: 'text', position: { x: 0, y: 0 }, text: 'too deep' }],
              },
            ],
          },
        ],
      },
    ],
  });
  expect(nested.type).toBe('blocked');
  expect(writeSvgExport({ graph }, options, { maxCharacters: 20 }).type).toBe('blocked');
  expect(writeSvgExport({ graph }, options, { maxPrimitives: 1 }).type).toBe('blocked');
  expect(() => writeSvgExport({ graph }, options, { maxDepth: 0 })).toThrow();
  expect(() => writeSvgExport({ graph }, options, { idPrefix: 'bad" onload=' })).toThrow();
  const adapter = { id: 'custom', version: '1', render: () => [] };
  expect(() => writeSvgExport({ graph }, input, { adapters: [adapter, adapter] })).toThrow();
});

test('unexpected adapter fields and cyclic groups are rejected, while native paths consume primitive budget', () => {
  const id = graph.nodes[0]?.id;
  if (!id) throw new Error('Expected node');
  const input = {
    ...options,
    renderers: {
      ...options.renderers,
      overrides: [
        {
          target: { kind: 'node', id },
          renderer: {
            type: 'svg',
            id: 'custom',
            version: '1',
            bounds: { x: 0, y: 0, width: 100, height: 100 },
            fidelity: 'equivalent',
            reason: 'Test vector',
          },
        },
      ],
    },
  } as const;
  const injected = {
    type: 'rect',
    position: { x: 0, y: 0 },
    width: 40,
    height: 40,
    onload: 'alert(1)',
  } as const;
  expect(
    writeSvgExport({ graph }, input, {
      adapters: [{ id: 'custom', version: '1', render: () => [injected] }],
    }).type,
  ).toBe('blocked');
  const children: ZlozSvgPrimitive[] = [];
  children.push({ type: 'group', children });
  expect(
    writeSvgExport({ graph }, input, {
      adapters: [{ id: 'custom', version: '1', render: () => children }],
    }).type,
  ).toBe('blocked');
  const emptyLabels = {
    nodes: graph.nodes.map((node) => ({
      ...node,
      label: '',
      ports: node.ports.map((port) => ({ ...port, label: '' })),
    })),
    edges: graph.edges.map((edge) => ({ ...edge, label: '' })),
  };
  expect(writeSvgExport({ graph: emptyLabels }, options, { maxPrimitives: 1 }).type).toBe(
    'blocked',
  );
});

test('semantic relationship notation cannot silently become an ordinary directed arrow', () => {
  const semantic = {
    ...graph,
    edges: graph.edges.map((edge) => ({
      ...edge,
      architecture: {
        family: 'ddd' as const,
        scope: 'strategic' as const,
        role: 'partnership' as const,
      },
    })),
  };
  const blocked = writeSvgExport({ graph: semantic }, options);
  expect(blocked.type).toBe('blocked');
  expect(blocked.findings.find((f) => f.code === 'semantic-edge-fallback')?.severity).toBe('loss');
  const accepted = writeSvgExport({ graph: semantic }, options, { allowLosses: true });
  expect(accepted.type).toBe('written');
  expect(accepted.findings.some((f) => f.code === 'semantic-edge-fallback')).toBe(true);
});
