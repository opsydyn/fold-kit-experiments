import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  auditDddRelationships,
  auditEventStormingRelationships,
  createEditor,
  parseGraph,
  serializeGraph,
  dddRelationshipRules,
  type ZlozDddRelationshipOptions,
  type ZlozGraph,
} from '../src/index';
import expected from './fixtures/ddd-audit-report.json';
import wire from './fixtures/ddd-audit-v1.json';
const graph = () => parseGraph(JSON.stringify(wire));
test('literal mixed-family graph produces the exact convention report without inference or editor mutation', () => {
  const editor = createEditor(graph()),
    before = JSON.stringify(editor);
  assert.deepStrictEqual(auditDddRelationships(editor.graph), expected);
  expect(JSON.stringify(editor)).toBe(before);
  expect(editor.past).toEqual([]);
  expect(
    auditEventStormingRelationships(editor.graph).entries.find((e) => e.edgeId === 'A-emits')
      ?.status,
  ).toBe('unrelated');
});
test('ordering is UTF-16 and independent of node/edge arrays; optional side roles remain absent', () => {
  const source = graph();
  const result = auditDddRelationships({
    nodes: [...source.nodes].reverse(),
    edges: [...source.edges].reverse(),
  });
  assert.deepStrictEqual(result, expected);
  expect(result.entries.map((e) => e.edgeId)).toEqual([
    'A-emits',
    'b-strategic',
    'c-side-absent',
    'd-role',
    'e-custom',
    'f-self',
    'g-foreign-participant',
    'i-causal',
    'j-bad-feed',
    'z-feeds',
    'á-untyped',
  ]);
  const absent = result.entries.find((e) => e.edgeId === 'c-side-absent');
  expect(absent?.architecture).toEqual({
    family: 'ddd',
    scope: 'strategic',
    role: 'customer-supplier',
  });
});
test('custom catalogues replace defaults and change findings, without changing authored descriptors', () => {
  const source = graph(),
    before = serializeGraph(source);
  const options: ZlozDddRelationshipOptions = {
    rules: [
      {
        architecture: { family: 'ddd', scope: 'tactical', role: 'custom', name: 'enriches' },
        sources: ['aggregate-root'],
        targets: ['domain-event'],
        label: 'Enriches',
        direction: 'directed',
      },
    ],
  };
  const result = auditDddRelationships(source, options);
  expect(result.summary).toEqual({ edges: 11, typed: 1, unrelated: 2, blocked: 8 });
  expect(result.entries.find((e) => e.edgeId === 'e-custom')).toEqual({
    edgeId: 'e-custom',
    edgeLabel: null,
    source: { node: 'root', port: 'out' },
    target: { node: 'event', port: 'in' },
    status: 'typed',
    code: 'compatible',
    architecture: { family: 'ddd', scope: 'tactical', role: 'custom', name: 'enriches' },
    relationshipKey: 'tactical:custom:enriches',
    message: 'Typed DDD relationship: Enriches.',
  });
  expect(result.entries.find((e) => e.edgeId === 'A-emits')?.code).toBe('unknown-relationship');
  expect(result.entries.find((e) => e.edgeId === 'f-self')?.code).toBe('same-context');
  expect(serializeGraph(source)).toBe(before);
});
test('reports detach endpoints and nested descriptors, exclude host extras, and preserve empty labels', () => {
  const source = graph();
  const decorated: ZlozGraph = {
    ...source,
    edges: source.edges.map((e) => ({
      ...e,
      label: '',
      source: { ...e.source, privateNote: 'not reported' },
      data: { privateNote: 'not reported' },
    })),
  };
  const result = auditDddRelationships(decorated);
  expect(JSON.stringify(result)).not.toContain('privateNote');
  expect(result.entries.every((e) => e.edgeLabel === '')).toBe(true);
  const entry = result.entries.find((e) => e.edgeId === 'b-strategic');
  assert(
    entry?.architecture?.scope === 'strategic' && entry.architecture.role === 'upstream-downstream',
  );
  Object.assign(entry.architecture.upstream ?? [], { 0: 'changed report' });
  Object.assign(entry.source, { node: 'changed report' });
  assert.deepStrictEqual(
    auditDddRelationships(decorated).entries.find((e) => e.edgeId === 'b-strategic')?.architecture,
    expected.entries[1]?.architecture,
  );
  const saved = auditDddRelationships(source);
  const authored = source.edges.find((e) => e.id === 'b-strategic');
  assert(
    authored?.architecture?.family === 'ddd' &&
      authored.architecture.scope === 'strategic' &&
      authored.architecture.role === 'upstream-downstream',
  );
  Object.assign(authored.architecture.upstream ?? [], { 0: 'changed source' });
  assert.deepStrictEqual(
    saved.entries.find((e) => e.edgeId === 'b-strategic')?.architecture,
    expected.entries[1]?.architecture,
  );
});
test('empty and wholly unrelated valid graphs are compatible without implying DDD coverage', () => {
  expect(auditDddRelationships({ nodes: [], edges: [] })).toEqual({
    status: 'compatible',
    summary: { edges: 0, typed: 0, unrelated: 0, blocked: 0 },
    entries: [],
  });
  const source = graph(),
    unrelated = auditDddRelationships({
      ...source,
      edges: source.edges.filter((e) => e.architecture?.family !== 'ddd'),
    });
  expect(unrelated.status).toBe('compatible');
  expect(unrelated.summary).toEqual({ edges: 2, typed: 0, unrelated: 2, blocked: 0 });
  const typed = auditDddRelationships({
    ...source,
    edges: source.edges.filter((e) =>
      ['A-emits', 'b-strategic', 'c-side-absent', 'z-feeds'].includes(e.id),
    ),
  });
  expect(typed.status).toBe('compatible');
  expect(typed.summary).toEqual({ edges: 4, typed: 4, unrelated: 0, blocked: 0 });
});
test('invalid catalogues reject even on empty/unrelated graphs; malformed graph syntax is not a semantic finding', () => {
  const first = dddRelationshipRules[0];
  assert(first);
  const invalid: ZlozDddRelationshipOptions[] = [
    { rules: [first, first] },
    { rules: [{ ...first, sources: [] }] },
    { rules: [{ ...first, direction: 'symmetric' }] },
    { rules: [{ ...first, targets: ['bounded-context'] }] },
  ];
  const source = graph(),
    unrelated = { ...source, edges: source.edges.filter((e) => e.architecture?.family !== 'ddd') };
  for (const options of invalid)
    for (const candidate of [{ nodes: [], edges: [] }, unrelated])
      assert.throws(() => auditDddRelationships(candidate, options), {
        name: 'ZlozError',
        code: 'invalid-edit',
      });
  for (const candidate of [
    { ...source, nodes: [] },
    { ...source, edges: [source.edges[0]!, source.edges[0]!] },
    { ...source, edges: [{ ...source.edges[0]!, source: { node: 'read', port: 'in' } }] },
  ])
    assert.throws(() => auditDddRelationships(candidate), {
      name: 'ZlozError',
      code: 'invalid-graph',
    });
  const raw = JSON.parse(JSON.stringify(wire));
  raw.graph.edges[0].architecture.extra = 'not a descriptor field';
  assert.throws(() => auditDddRelationships(raw.graph), {
    name: 'ZlozError',
    code: 'invalid-graph',
  });
});
