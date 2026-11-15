import { expect, test } from 'bun:test';

import {
  createSvgReview,
  resolveSvgReview,
  updateSvgReview,
  createEditor,
  createArchitecturePattern,
  inspectSvgFontCoverage,
  writeSvgExport,
  type ZlozSvgExportOptions,
} from '../src/index';
import { fontBytes, fontWithCmap, cmap, format4, format12 } from './helpers/font-cmap';
const resource = { assetId: 'inter', format: 'truetype', bytes: fontBytes } as const;
const snapshot = createEditor(createArchitecturePattern('c4-context'));
const options: ZlozSvgExportOptions = {
  title: 'Metadata 漢',
  description: 'Metadata 😀',
  region: { type: 'model', padding: 24 },
  theme: { colorScheme: 'light' },
  background: { type: 'theme' },
  font: { family: 'Inter', size: 14, weight: 400, assetId: 'inter' },
  assets: [{ id: 'inter', kind: 'font', availability: 'embedded' }],
  renderers: { nodes: 'built-in', edges: 'built-in' },
};
test('real font coverage reports unique Unicode scalars, preserving layout and sequence uncertainty', () => {
  const result = inspectSvgFontCoverage(resource, 'Orders A漢😀漢\n\r\t\u200d\ufe0f');
  expect(result.type).toBe('checked');
  if (result.type !== 'checked') throw new Error('Expected coverage');
  expect(result.missingCodePoints).toEqual([0x6f22, 0x1f600]);
  expect(result.unverifiedCodePoints).toEqual([0x200d, 0xfe0f]);
  expect(inspectSvgFontCoverage(resource, '\ud800').type).toBe('invalid');
  expect(inspectSvgFontCoverage(resource, 'AAAA', { maxCharacters: 3 }).type).toBe('invalid');
});
test('format 4 handles direct deltas, range words, zero glyph holes and delta modulo correctly', () => {
  const font = {
    ...resource,
    bytes: fontWithCmap(cmap([{ platform: 3, encoding: 1, table: format4() }])),
  };
  expect(inspectSvgFontCoverage(font, 'ABCDE')).toEqual({
    type: 'checked',
    format: 4,
    checkedCodePoints: 5,
    missingCodePoints: [67, 69],
    unverifiedCodePoints: [],
  });
});
test('format 12 checks supplementary scalars and takes precedence over BMP maps without unioning coverage', () => {
  const font = {
    ...resource,
    bytes: fontWithCmap(
      cmap([
        { platform: 3, encoding: 1, table: format4() },
        { platform: 3, encoding: 10, table: format12() },
      ]),
    ),
  };
  expect(inspectSvgFontCoverage(font, 'AB😀😁😂')).toEqual({
    type: 'checked',
    format: 12,
    checkedCodePoints: 5,
    missingCodePoints: [66, 0x1f602],
    unverifiedCodePoints: [],
  });
});
test('malformed selected cmaps block while unsupported Unicode maps stay explicitly unverified', () => {
  const bad4 = format4();
  bad4.writeUInt16BE(0xfffe, 36);
  const bad12 = format12();
  bad12.writeUInt32BE(0xffffffff, 36);
  for (const table of [bad4, bad12]) {
    const font = {
      ...resource,
      bytes: fontWithCmap(cmap([{ platform: 3, encoding: table === bad4 ? 1 : 10, table }])),
    };
    const result = writeSvgExport(snapshot, options, { fontResources: [font], allowLosses: true });
    expect(result.type).toBe('blocked');
    expect('svg' in result).toBe(false);
    expect(
      result.findings.some((f) => f.code === 'font-cmap-invalid' && f.severity === 'unsupported'),
    ).toBe(true);
  }
  const unsupported = Buffer.alloc(12);
  unsupported.writeUInt16BE(13, 0);
  const unknown = {
    ...resource,
    bytes: fontWithCmap(cmap([{ platform: 0, encoding: 6, table: unsupported }])),
  };
  expect(inspectSvgFontCoverage(unknown, 'Orders').type).toBe('unverified');
  const result = writeSvgExport(snapshot, options, { fontResources: [unknown] });
  expect(result.type).toBe('written');
  expect(result.findings.some((f) => f.code === 'font-coverage-unverified')).toBe(true);
});
test('writer checks emitted node, port, edge, architecture and custom primitive text; metadata and omissions do not create losses', () => {
  const first = snapshot.graph.nodes[0];
  if (!first) throw new Error('Missing node');
  const base = writeSvgExport(snapshot, options, { fontResources: [resource] });
  expect(base.type).toBe('written');
  expect(base.findings.some((f) => f.code === 'font-glyph-missing')).toBe(false);
  const changed = {
    ...snapshot,
    graph: {
      ...snapshot.graph,
      nodes: snapshot.graph.nodes.map((n, i) =>
        i === 0 ? { ...n, label: '漢', ports: n.ports.map((p) => ({ ...p, label: '😀' })) } : n,
      ),
    },
  };
  const before = JSON.stringify(changed);
  const result = writeSvgExport(changed, options, { fontResources: [resource] });
  expect(result.type).toBe('blocked');
  expect(result.findings).toContainEqual(
    expect.objectContaining({
      code: 'font-glyph-missing',
      severity: 'loss',
      target: { kind: 'node', id: first.id },
      codePoints: [0x6f22, 0x1f600],
    }),
  );
  const accepted = writeSvgExport(changed, options, {
    fontResources: [resource],
    allowLosses: true,
  });
  expect(accepted.type).toBe('written');
  expect(JSON.stringify(changed)).toBe(before);
  const custom = {
    ...options,
    renderers: {
      ...options.renderers,
      overrides: [
        {
          target: { kind: 'node' as const, id: first.id },
          renderer: {
            type: 'svg' as const,
            id: 'test',
            version: '1',
            bounds: { x: 0, y: 0, width: 1000, height: 1000 },
            fidelity: 'equivalent' as const,
            reason: 'Test',
          },
        },
      ],
    },
  };
  const adapted = writeSvgExport(snapshot, custom, {
    fontResources: [resource],
    adapters: [
      {
        id: 'test',
        version: '1',
        render: () => [
          { type: 'group', children: [{ type: 'text', position: { x: 0, y: 0 }, text: '漢' }] },
        ],
      },
    ],
  });
  expect(
    adapted.findings.some(
      (f) =>
        f.code === 'font-glyph-missing' && f.target.kind === 'node' && f.target.id === first.id,
    ),
  ).toBe(true);
});

test('an omitted item never inherits glyph findings from a preceding rendered item', () => {
  const first = snapshot.graph.nodes[0],
    second = snapshot.graph.nodes[1];
  if (!first || !second) throw new Error('Missing nodes');
  const changed = {
    ...snapshot,
    graph: {
      ...snapshot.graph,
      nodes: snapshot.graph.nodes.map((n, i) => (i === 0 ? { ...n, label: '漢' } : n)),
    },
  };
  const result = writeSvgExport(
    changed,
    {
      ...options,
      renderers: {
        ...options.renderers,
        overrides: [
          {
            target: { kind: 'node', id: second.id },
            renderer: { type: 'omit', reason: 'Hidden from output' },
          },
        ],
      },
    },
    { fontResources: [resource], allowLosses: true },
  );
  expect(result.type).toBe('written');
  expect(
    result.findings.filter((f) => f.code === 'font-glyph-missing').map((f) => f.target),
  ).toEqual([{ kind: 'node', id: first.id }]);
});

test('new missing-glyph losses require the existing exact-artifact review acceptance', () => {
  const changed = {
    ...snapshot,
    graph: {
      ...snapshot.graph,
      nodes: snapshot.graph.nodes.map((n, i) => (i === 0 ? { ...n, label: '漢' } : n)),
    },
  };
  const context = {
    ...options,
    scope: 'coverage',
    sourceRevision: 0,
    snapshot: changed,
    writing: { fontResources: [resource] },
  };
  const state = createSvgReview('coverage'),
    controls = resolveSvgReview(state, context);
  expect(controls.hasLosses).toBe(true);
  expect(
    updateSvgReview(state, context, { ...controls.identity, type: 'SvgDownloadRequested' }).payload,
  ).toBeNull();
  const accepted = updateSvgReview(state, context, {
    ...controls.identity,
    type: 'SvgLossAcceptanceChanged',
    accepted: true,
  }).state;
  expect(
    updateSvgReview(accepted, context, { ...controls.identity, type: 'SvgDownloadRequested' })
      .payload?.svg,
  ).toContain('漢');
});
test('metadata, omitted replacements and system fonts do not create false glyph claims', () => {
  const first = snapshot.graph.nodes[0],
    edge = snapshot.graph.edges[0];
  if (!first || !edge) throw new Error('Missing fixtures');
  const graph = {
    ...snapshot.graph,
    nodes: snapshot.graph.nodes.map((n, i) =>
      i === 0 && n.architecture?.family === 'c4'
        ? { ...n, architecture: { ...n.architecture, description: '漢' } }
        : n,
    ),
    edges: snapshot.graph.edges.map((e, i) => (i === 0 ? { ...e, label: '😀' } : e)),
  };
  const result = writeSvgExport({ graph }, options, {
    fontResources: [resource],
    allowLosses: true,
  });
  expect(result.findings).toContainEqual(
    expect.objectContaining({
      code: 'font-glyph-missing',
      target: { kind: 'edge', id: edge.id },
      codePoints: [0x1f600],
    }),
  );
  expect(
    result.findings.some(
      (f) =>
        f.code === 'font-glyph-missing' && f.target.kind === 'node' && f.target.id === first.id,
    ),
  ).toBe(true);
  const omitted = writeSvgExport(
    {
      ...snapshot,
      graph: { ...snapshot.graph, nodes: snapshot.graph.nodes.map((n) => ({ ...n, label: '漢' })) },
    },
    {
      ...options,
      renderers: {
        ...options.renderers,
        overrides: snapshot.graph.nodes.map((n) => ({
          target: { kind: 'node' as const, id: n.id },
          renderer: { type: 'omit' as const, reason: 'Do not draw' },
        })),
      },
    },
    { fontResources: [resource], allowLosses: true },
  );
  expect(omitted.findings.some((f) => f.code === 'font-glyph-missing')).toBe(false);
  const system = writeSvgExport(
    { graph },
    { ...options, font: { family: 'sans-serif', weight: 400, size: 14 }, assets: [] },
  );
  expect(system.findings.some((f) => f.code === 'font-glyph-missing')).toBe(false);
  expect(system.findings.some((f) => f.code === 'font-unverified')).toBe(true);
});

test('truncated encoding records and unordered groups fail, and unsupported mappings still respect text limits', () => {
  const outside = cmap([{ platform: 3, encoding: 1, table: format4() }]);
  outside.writeUInt32BE(0xffffffff, 8);
  const unordered = format12();
  unordered.writeUInt32BE(64, 28);
  for (const replacement of [outside, cmap([{ platform: 3, encoding: 10, table: unordered }])]) {
    expect(inspectSvgFontCoverage({ ...resource, bytes: fontWithCmap(replacement) }, 'A')).toEqual(
      expect.objectContaining({ type: 'invalid', code: 'font-cmap-invalid' }),
    );
  }
  const table = Buffer.alloc(12);
  table.writeUInt16BE(13, 0);
  const unknown = { ...resource, bytes: fontWithCmap(cmap([{ platform: 0, encoding: 6, table }])) };
  expect(inspectSvgFontCoverage(unknown, 'AAAA', { maxCharacters: 3 })).toEqual(
    expect.objectContaining({ type: 'invalid', code: 'font-coverage-limit' }),
  );
  expect(inspectSvgFontCoverage(unknown, '\ud800')).toEqual(
    expect.objectContaining({ type: 'invalid', code: 'font-text-invalid' }),
  );
});

test('font bytes and coverage use one snapshot even if a host adapter mutates its original resource', () => {
  const first = snapshot.graph.nodes[0];
  if (!first) throw new Error('Missing node');
  const mutable = { ...resource, bytes: fontBytes.slice() };
  const result = writeSvgExport(
    snapshot,
    {
      ...options,
      renderers: {
        ...options.renderers,
        overrides: [
          {
            target: { kind: 'node', id: first.id },
            renderer: {
              type: 'svg',
              id: 'mutator',
              version: '1',
              bounds: { x: 0, y: 0, width: 1000, height: 1000 },
              fidelity: 'equivalent',
              reason: 'Snapshot isolation test',
            },
          },
        ],
      },
    },
    {
      fontResources: [mutable],
      allowLosses: true,
      adapters: [
        {
          id: 'mutator',
          version: '1',
          render: () => {
            // Deliberately violate adapter purity to prove byte-snapshot isolation.
            mutable.bytes.fill(0);
            return [{ type: 'text', position: { x: 0, y: 0 }, text: '漢' }];
          },
        },
      ],
    },
  );
  expect(result.type).toBe('written');
  expect(
    result.findings.some((f) => f.code === 'font-glyph-missing' && f.codePoints?.includes(0x6f22)),
  ).toBe(true);
  const next = writeSvgExport(snapshot, options, { fontResources: [mutable], allowLosses: true });
  expect(next.type).toBe('blocked');
});
