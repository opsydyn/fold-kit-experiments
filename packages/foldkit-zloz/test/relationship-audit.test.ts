import { expect, test } from 'bun:test';

import {
  auditEventStormingRelationships,
  createEventStormingPattern,
  eventStormingRelationshipRules,
  serializeGraph,
  type ZlozGraph,
} from '../src/index';
test('audit is read-only and separates typed, inferred, unrelated and blocked edges in deterministic identity order', () => {
  const process = createEventStormingPattern();
  const first = process.edges[0],
    second = process.edges[1];
  if (!first || !second) throw new Error('Missing process');
  const { architecture: _architecture, ...legacy } = second;
  const plain = process.nodes.map((node) => {
    const { architecture: _node, ...value } = node;
    return { ...value, id: `plain:${node.id}` };
  });
  const graph: ZlozGraph = {
    nodes: [...process.nodes, ...plain],
    edges: [
      { ...first, id: 'z:typed' },
      { ...legacy, id: 'a:inferred' },
      { ...first, id: 'b:blocked', architecture: { family: 'event-storming', role: 'emits' } },
      {
        id: 'c:unrelated',
        source: { node: 'plain:note:0', port: 'out' },
        target: { node: 'plain:note:1', port: 'in' },
      },
    ],
  };
  const before = serializeGraph(graph),
    audit = auditEventStormingRelationships(graph);
  expect(audit.status).toBe('incompatible');
  expect(audit.summary).toEqual({ edges: 4, typed: 1, inferred: 1, unrelated: 1, blocked: 1 });
  expect(audit.entries.map((entry) => entry.edgeId)).toEqual([
    'a:inferred',
    'b:blocked',
    'c:unrelated',
    'z:typed',
  ]);
  expect(audit.entries.map((entry) => entry.status)).toEqual([
    'inferred',
    'blocked',
    'unrelated',
    'typed',
  ]);
  const blocked = audit.entries.find((entry) => entry.status === 'blocked');
  expect(blocked?.code).toBe('incompatible-roles');
  expect(blocked?.message).toContain('does not allow');
  expect(serializeGraph(graph)).toBe(before);
  expect(auditEventStormingRelationships({ ...graph, edges: [...graph.edges].reverse() })).toEqual(
    audit,
  );
  expect(graph.edges.map((edge) => edge.id)).toEqual([
    'z:typed',
    'a:inferred',
    'b:blocked',
    'c:unrelated',
  ]);
});
test('custom rules and node interpretation use the existing resolver; incompatible catalogues never disappear on empty graphs', () => {
  const graph = createEventStormingPattern();
  const edge = graph.edges[0];
  if (!edge) throw new Error('Missing edge');
  const custom: ZlozGraph = {
    ...graph,
    edges: [
      { ...edge, architecture: { family: 'event-storming', role: 'custom', name: 'approves' } },
    ],
  };
  expect(auditEventStormingRelationships(custom).summary.blocked).toBe(1);
  const options = {
    rules: [
      {
        architecture: {
          family: 'event-storming' as const,
          role: 'custom' as const,
          name: 'approves',
        },
        sources: ['actor' as const],
        targets: ['command' as const],
        label: 'Approves',
      },
    ],
  };
  const report = auditEventStormingRelationships(custom, options);
  expect(report.status).toBe('compatible');
  expect(report.entries[0]?.architecture).toEqual(custom.edges[0]?.architecture);
  expect(auditEventStormingRelationships({ nodes: [], edges: [] }).summary).toEqual({
    edges: 0,
    typed: 0,
    inferred: 0,
    unrelated: 0,
    blocked: 0,
  });
  const rule = eventStormingRelationshipRules[0];
  if (!rule) throw new Error('Missing rule');
  expect(() =>
    auditEventStormingRelationships({ nodes: [], edges: [] }, { rules: [rule, rule] }),
  ).toThrow();
});

test('report projections exclude host-owned edge and endpoint extras', () => {
  const graph = createEventStormingPattern(),
    first = graph.edges[0];
  if (!first) throw new Error('Missing edge');
  const source = { ...first.source, privateNote: 'endpoint-private' };
  const edge = { ...first, source, data: { privateNote: 'edge-private' } };
  const audit = auditEventStormingRelationships({ ...graph, edges: [edge] });
  expect(audit.entries[0]?.source).toEqual(first.source);
  expect(JSON.stringify(audit)).not.toContain('private');
});
