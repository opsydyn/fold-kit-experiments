import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  createEditor,
  parseGraph,
  planPngExport,
  writeSvgExport,
  type ZlozSvgExportOptions,
} from '../src/index';
import wire from './fixtures/workshop-v1.json';
const options: ZlozSvgExportOptions = {
  title: 'Workshop <review>',
  region: { type: 'model', padding: 40 },
  background: { type: 'theme' },
  theme: { colorScheme: 'light' },
  font: { family: 'sans-serif', size: 14, weight: 400 },
  renderers: { nodes: 'built-in', edges: 'built-in' },
};
function artwork(svg: string, id: string): string {
  const start = svg.indexOf(`data-zloz-export-node="${id}"`);
  assert(start >= 0);
  const end = svg.indexOf('data-zloz-export-node=', start + 1);
  return svg.slice(start, end < 0 ? undefined : end);
}
for (const [scheme, external, open, resolved, lane] of [
  ['light', '#0e7490', '#be123c', '#047857', '#64748b'],
  ['dark', '#67e8f9', '#fda4af', '#6ee7b7', '#94a3b8'],
] as const) {
  test(`workshop SVG preserves authored status, frame, ports and accents in ${scheme}; PNG carries the identical projection`, () => {
    const editor = createEditor(parseGraph(JSON.stringify(wire)));
    const before = JSON.stringify(editor);
    const opts = { ...options, theme: { colorScheme: scheme } };
    const result = writeSvgExport(editor, opts, { allowLosses: true });
    assert(result.type === 'written');
    expect(artwork(result.svg, 'system')).toContain(`stroke="${external}"`);
    expect(artwork(result.svg, 'system')).toContain('stroke-dasharray="6 4"');
    expect(artwork(result.svg, 'system')).toContain('External system');
    expect(artwork(result.svg, 'system').match(/data-zloz-export-port=/gu)).toHaveLength(2);
    expect(artwork(result.svg, 'lane')).toContain(`stroke="${lane}"`);
    expect(artwork(result.svg, 'lane')).toContain('Workshop lane');
    const hotspot = artwork(result.svg, 'hotspot');
    expect(hotspot).toContain(`stroke="${open}"`);
    expect(hotspot).toContain('Open question');
    expect(hotspot).not.toContain('data-zloz-export-port=');
    expect(hotspot).not.toContain('Resolved');
    const changed = {
      graph: {
        ...editor.graph,
        nodes: editor.graph.nodes.map((node) =>
          node.architecture?.family === 'event-storming' && node.architecture.role === 'hotspot'
            ? { ...node, architecture: { ...node.architecture, status: 'resolved' as const } }
            : node,
        ),
      },
    };
    const next = writeSvgExport(changed, opts, { allowLosses: true });
    assert(next.type === 'written');
    expect(artwork(next.svg, 'hotspot')).toContain(`stroke="${resolved}"`);
    expect(artwork(next.svg, 'hotspot')).toContain('Resolved');
    expect(artwork(next.svg, 'hotspot')).not.toContain('Open question');
    expect(next.svg).not.toBe(result.svg);
    const png = planPngExport(result);
    assert(png.type === 'ready');
    expect(png.svg).toBe(result.svg);
    expect(png.findings).toContainEqual(expect.objectContaining({ code: 'rasterization-loss' }));
    expect(result.findings).toContainEqual(expect.objectContaining({ code: 'font-unverified' }));
    expect(JSON.stringify(editor)).toBe(before);
  });
}
test('custom workshop shell loss remains explicit, escaped and subject to consent and resource limits', () => {
  const graph = parseGraph(JSON.stringify(wire));
  const snapshot = {
    graph: { ...graph, nodes: graph.nodes.map((n) => ({ ...n, label: '<script>&"' })) },
  };
  const custom = {
    ...options,
    renderers: {
      ...options.renderers,
      overrides: [
        {
          target: { kind: 'node' as const, id: 'hotspot' },
          renderer: {
            type: 'fallback' as const,
            reason: 'Custom Discuss badge becomes canonical status text.',
          },
        },
      ],
    },
  };
  const blocked = writeSvgExport(snapshot, custom);
  expect(blocked.type).toBe('blocked');
  expect(blocked.findings).toContainEqual(
    expect.objectContaining({ code: 'loss-consent-required' }),
  );
  const accepted = writeSvgExport(snapshot, custom, { allowLosses: true });
  assert(accepted.type === 'written');
  expect(accepted.svg).toContain('&lt;script&gt;&amp;&quot;');
  expect(accepted.svg).toContain('Open question');
  expect(accepted.svg).not.toContain('<script>');
  expect(accepted.findings).toContainEqual(expect.objectContaining({ code: 'renderer-fallback' }));
  const limited = writeSvgExport(snapshot, options, { maxPrimitives: 1, allowLosses: true });
  expect(limited.type).toBe('blocked');
  expect(limited.findings).toContainEqual(
    expect.objectContaining({
      code: 'svg-output-invalid',
      reason: 'SVG primitive budget exceeded.',
    }),
  );
});
test('portable workshop artwork honours explicit host theme tokens rather than hardcoding its palette', () => {
  const snapshot = { graph: parseGraph(JSON.stringify(wire)) };
  const written = writeSvgExport(
    snapshot,
    {
      ...options,
      theme: {
        colorScheme: 'dark',
        tokens: {
          eventStormingExternalSystem: '#123456',
          eventStormingHotspotOpen: '#654321',
          eventStormingLane: '#345678',
        },
      },
    },
    { allowLosses: true },
  );
  assert(written.type === 'written');
  expect(artwork(written.svg, 'system')).toContain('stroke="#123456"');
  expect(artwork(written.svg, 'hotspot')).toContain('stroke="#654321"');
  expect(artwork(written.svg, 'lane')).toContain('stroke="#345678"');
  expect(artwork(written.svg, 'hotspot')).toContain('Open question');
});
