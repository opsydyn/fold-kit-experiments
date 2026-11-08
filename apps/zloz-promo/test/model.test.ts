import { expect, test } from 'bun:test';

import { parseGraph, serializeGraph, validateGraph } from '@opsydyn/foldkit-flow';

import { contextGraph, mermaidBundle } from '../src/lib/context-model';

test('the downloadable context preserves C4 meaning and stable connection identities', () => {
  validateGraph(contextGraph);
  const restored = parseGraph(serializeGraph(contextGraph));
  expect(restored).toEqual(contextGraph);
  expect(restored.nodes.map((node) => node.id)).toEqual([
    'customer',
    'orders',
    'payments',
    'delivery',
  ]);
  expect(restored.nodes.map((node) => node.architecture?.family)).toEqual(['c4', 'c4', 'c4', 'c4']);
  expect(restored.edges.map((edge) => [edge.source.node, edge.target.node])).toEqual([
    ['customer', 'orders'],
    ['orders', 'payments'],
    ['orders', 'delivery'],
  ]);
});

test('Mermaid downloads retain identity and disclose omitted model and layout information', () => {
  expect(mermaidBundle.source).toContain('flowchart LR');
  expect(mermaidBundle.source).toContain('Order platform');
  expect(mermaidBundle.identity.nodes.map((node) => node.flowId)).toEqual(
    contextGraph.nodes.map((node) => node.id),
  );
  expect(mermaidBundle.identity.edges.map((edge) => edge.flowId)).toEqual(
    contextGraph.edges.map((edge) => edge.id),
  );
  expect(mermaidBundle.diagnostics.some((item) => item.code === 'layout-omitted')).toBe(true);
  expect(mermaidBundle.diagnostics.some((item) => item.code === 'node-fields-omitted')).toBe(true);
  expect(mermaidBundle.diagnostics.every((item) => item.severity === 'loss')).toBe(true);
});
