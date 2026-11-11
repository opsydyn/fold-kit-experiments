import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  createContextMapPattern,
  resolveContextMapRelationship,
  createArchitecturePattern,
  createEditor,
  insertPattern,
  updateEditor,
  dddRelationshipPolicy,
  parseGraph,
  serializeGraph,
} from '../src/index';
test('the detached starter has four real ported contexts and all four strategic contracts', () => {
  const graph = createContextMapPattern();
  expect(graph.nodes.map((n) => n.label)).toEqual(['Orders', 'Billing', 'Catalog', 'Inventory']);
  expect(
    graph.nodes.every(
      (n) => n.kind !== 'group' && n.ports.length > 0 && n.architecture?.role === 'bounded-context',
    ),
  ).toBe(true);
  expect(graph.edges.map((e) => e.architecture?.role)).toEqual([
    'upstream-downstream',
    'customer-supplier',
    'shared-kernel',
    'partnership',
  ]);
  expect(createArchitecturePattern('context-map')).toEqual(graph);
  expect(parseGraph(serializeGraph(graph))).toEqual(graph);
  expect(createContextMapPattern().nodes[0]).not.toBe(graph.nodes[0]);
  for (const edge of graph.edges) {
    const value = resolveContextMapRelationship(graph, edge);
    assert(value);
    expect(value.reason).toBeNull();
  }
});
test('the projection names roles and direction independently of labels and diagnostics', () => {
  const graph = createContextMapPattern(),
    first = graph.edges[0];
  assert(first);
  const value = resolveContextMapRelationship(graph, { ...first, label: '' });
  assert(value);
  expect(value.direction).toBe('directed');
  expect(value.source.name).toBe('Orders');
  expect(value.target.name).toBe('Billing');
  expect(value.source.badges.map((b) => b.text)).toEqual(['Upstream', 'OHS', 'PL']);
  expect(value.target.badges.map((b) => b.text)).toEqual(['Downstream', 'ACL']);
  const symmetric = graph.edges.find((e) => e.architecture?.role === 'shared-kernel');
  assert(symmetric);
  expect(resolveContextMapRelationship(graph, symmetric)?.direction).toBe('symmetric');
  const custom = {
    ...first,
    architecture: {
      family: 'ddd' as const,
      scope: 'strategic' as const,
      role: 'custom' as const,
      name: 'affiliate',
    },
  };
  const unresolved = resolveContextMapRelationship(graph, custom);
  assert(unresolved);
  expect(unresolved.direction).toBeNull();
  expect(unresolved.reason).toContain('convention');
  const rules = [
    {
      architecture: custom.architecture,
      sources: ['bounded-context' as const],
      targets: ['bounded-context' as const],
      direction: 'symmetric' as const,
      label: 'Affiliates',
    },
  ];
  expect(resolveContextMapRelationship(graph, custom, { rules })?.direction).toBe('symmetric');
  expect(
    resolveContextMapRelationship(graph, {
      ...first,
      architecture: { family: 'ddd', scope: 'tactical', role: 'uses' },
    }),
  ).toBeNull();
  expect(resolveContextMapRelationship(graph, first, { rules: [] })?.reason).toContain(
    'convention',
  );
});
test('insertion retains ordinary policy, deterministic IDs and one Undo', () => {
  const state = createEditor({ nodes: [], edges: [] }),
    graph = createContextMapPattern();
  const inserted = insertPattern(state, graph, { policy: dddRelationshipPolicy() });
  assert(inserted.type === 'inserted');
  expect(inserted.editor.past).toHaveLength(1);
  expect(updateEditor(inserted.editor, { type: 'UndoPressed' }).graph).toEqual(state.graph);
  const blocked = insertPattern(state, graph, { policy: { canInsertPattern: () => 'Owner veto' } });
  expect(blocked.type).toBe('blocked');
  expect(blocked.editor).toBe(state);
});
