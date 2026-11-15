import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  isDddEdgeArchitecture,
  dddRelationshipRules,
  resolveDddRelationship,
  dddRelationshipPolicy,
  createEditor,
  updateEditor,
  parseGraph,
  serializeGraph,
  captureEdition,
  compareEditions,
  resolveEventStormingRelationship,
  auditEventStormingRelationships,
  eventStormingRelationshipPolicy,
  resolveEventStormingRelationshipControls,
  resolveEventStormingRelationshipRequest,
  ZlozError,
  type DddEdgeArchitecture,
  type ZlozGraph,
  type ZlozNode,
  type DddNodeArchitecture,
} from '../src/index';
function node(id: string, role: DddNodeArchitecture['role'], group = false): ZlozNode {
  const base: ZlozNode = {
    id,
    label: id,
    position: { x: 0, y: 0 },
    size: { width: 200, height: 100 },
    ports: group
      ? []
      : [
          { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
          { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
        ],
    architecture: { family: 'ddd', role },
  };
  return group ? { ...base, kind: 'group' } : base;
}
function graph(architecture?: DddEdgeArchitecture): ZlozGraph {
  const edge = {
    id: 'link',
    source: { node: 'a', port: 'out' },
    target: { node: 'b', port: 'in' },
  };
  return {
    nodes: [node('a', 'bounded-context'), node('b', 'bounded-context')],
    edges: [architecture ? { ...edge, architecture } : edge],
  };
}
const upstream: DddEdgeArchitecture = {
  family: 'ddd',
  scope: 'strategic',
  role: 'upstream-downstream',
  upstream: ['open-host-service', 'published-language'],
  downstream: 'anti-corruption-layer',
};
test('literal v1 DDD descriptors retain directional and symmetric meaning without a new format', () => {
  const literal =
    '{"version":1,"graph":{"nodes":[{"id":"a","label":"A","position":{"x":0,"y":0},"size":{"width":100,"height":100},"ports":[{"id":"out","kind":"output","side":"right","offset":0.5}],"architecture":{"family":"ddd","role":"bounded-context"}},{"id":"b","label":"B","position":{"x":200,"y":0},"size":{"width":100,"height":100},"ports":[{"id":"in","kind":"input","side":"left","offset":0.5}],"architecture":{"family":"ddd","role":"bounded-context"}}],"edges":[{"id":"r","source":{"node":"a","port":"out"},"target":{"node":"b","port":"in"},"architecture":{"family":"ddd","scope":"strategic","role":"upstream-downstream","upstream":["open-host-service","published-language"],"downstream":"anti-corruption-layer"}}]}}';
  const value = parseGraph(literal);
  expect(value.edges[0]?.architecture).toEqual(upstream);
  expect(parseGraph(serializeGraph(value))).toEqual(value);
  const relation = resolveDddRelationship(value, {
    sourceNodeId: 'a',
    targetNodeId: 'b',
    architecture: upstream,
  });
  assert(relation.type === 'allowed');
  expect(relation.direction).toBe('directed');
  const symmetric = resolveDddRelationship(value, {
    sourceNodeId: 'b',
    targetNodeId: 'a',
    architecture: { family: 'ddd', scope: 'strategic', role: 'shared-kernel' },
  });
  assert(symmetric.type === 'allowed');
  expect(symmetric.direction).toBe('symmetric');
  expect(dddRelationshipRules.map((rule) => rule.architecture.role)).toEqual([
    'references',
    'contains',
    'emits',
    'persists',
    'uses',
    'partnership',
    'shared-kernel',
    'upstream-downstream',
    'customer-supplier',
    'feeds',
  ]);
});
test('reserved syntax rejects mixed scopes, unknown fields and wrong side roles', () => {
  for (const bad of [
    { ...upstream, scope: 'tactical' },
    { ...upstream, role: 'partnership' },
    { ...upstream, upstream: ['anti-corruption-layer'] },
    { ...upstream, upstream: ['published-language', 'published-language'] },
    { ...upstream, upstream: [] },
    { ...upstream, downstream: 'open-host-service' },
    { ...upstream, extra: true },
    { family: 'ddd', role: 'uses' },
    { family: 'ddd', scope: 'tactical', role: 'custom', name: ' ' },
    { family: 'ddd', scope: 'strategic', role: 'references' },
  ])
    expect(isDddEdgeArchitecture(bad)).toBe(false);
  expect(
    isDddEdgeArchitecture({ family: 'ddd', scope: 'tactical', role: 'custom', name: 'owns' }),
  ).toBe(true);
});
test('logical context boundaries stay portless; drawable edges still reject invented group ports', () => {
  const value = {
    nodes: [node('a', 'bounded-context', true), node('b', 'bounded-context', true)],
    edges: [],
  };
  expect(
    resolveDddRelationship(value, { sourceNodeId: 'a', targetNodeId: 'b', architecture: upstream })
      .type,
  ).toBe('allowed');
  expect(() => createEditor({ ...value, edges: graph(upstream).edges })).toThrow();
  const self = resolveDddRelationship(value, {
    sourceNodeId: 'a',
    targetNodeId: 'a',
    architecture: upstream,
  });
  assert(self.type === 'blocked');
  expect(self.code).toBe('same-context');
  const missing = resolveDddRelationship(value, {
    sourceNodeId: 'missing',
    targetNodeId: 'b',
    architecture: upstream,
  });
  assert(missing.type === 'blocked');
  expect(missing.code).toBe('missing-node');
});
test('tactical conventions, custom catalogues and host vetoes remain explicit', () => {
  const value = {
    nodes: [node('a', 'repository'), node('b', 'aggregate-root')],
    edges: graph().edges,
  };
  const persists: DddEdgeArchitecture = { family: 'ddd', scope: 'tactical', role: 'persists' };
  expect(
    resolveDddRelationship(value, { sourceNodeId: 'a', targetNodeId: 'b', architecture: persists })
      .type,
  ).toBe('allowed');
  const wrong = resolveDddRelationship(value, {
    sourceNodeId: 'b',
    targetNodeId: 'a',
    architecture: persists,
  });
  assert(wrong.type === 'blocked');
  expect(wrong.code).toBe('incompatible-roles');
  const custom: DddEdgeArchitecture = {
    family: 'ddd',
    scope: 'tactical',
    role: 'custom',
    name: 'stores',
  };
  const rule = {
    architecture: custom,
    sources: ['repository' as const],
    targets: ['aggregate-root' as const],
    label: 'Stores',
    direction: 'directed' as const,
  };
  expect(
    resolveDddRelationship(value, { sourceNodeId: 'a', targetNodeId: 'b', architecture: custom })
      .type,
  ).toBe('blocked');
  expect(
    resolveDddRelationship(
      value,
      { sourceNodeId: 'a', targetNodeId: 'b', architecture: custom },
      { rules: [rule] },
    ).type,
  ).toBe('allowed');
  expect(() => dddRelationshipPolicy({ rules: [rule, rule] })).toThrow();
  const state = createEditor(value),
    policy = dddRelationshipPolicy({}, { canChangeEdgeArchitecture: () => 'Owner veto' });
  const blocked = updateEditor(
    state,
    { type: 'EdgeArchitectureChanged', id: 'link', architecture: persists },
    policy,
  );
  expect(blocked.notice).toBe('Owner veto');
  expect(blocked.graph).toBe(state.graph);
  expect(blocked.past).toHaveLength(0);
});
test('meaning edits are detached, value-equal no-ops, undoable and visible in history', () => {
  const state = createEditor(graph());
  const descriptor = {
    ...upstream,
    upstream: ['open-host-service' as const, 'published-language' as const],
  };
  const edited = updateEditor(
    state,
    { type: 'EdgeArchitectureChanged', id: 'link', architecture: descriptor },
    dddRelationshipPolicy(),
  );
  expect(edited.past).toHaveLength(1);
  expect(edited.revision).toBe(state.revision + 1);
  expect(edited.graph.edges[0]?.architecture).not.toBe(descriptor);
  expect(
    updateEditor(edited, {
      type: 'EdgeArchitectureChanged',
      id: 'link',
      architecture: {
        downstream: 'anti-corruption-layer',
        upstream: ['open-host-service', 'published-language'],
        role: 'upstream-downstream',
        scope: 'strategic',
        family: 'ddd',
      },
    }),
  ).toBe(edited);
  descriptor.upstream.pop();
  expect(edited.graph.edges[0]?.architecture).toEqual(upstream);
  const restored = updateEditor(edited, { type: 'UndoPressed' });
  expect(restored.graph).toEqual(state.graph);
  expect(updateEditor(restored, { type: 'RedoPressed' }).graph).toEqual(edited.graph);
  expect(
    compareEditions(
      captureEdition({ id: 'a', name: 'A', snapshot: { graph: state.graph } }),
      captureEdition({ id: 'b', name: 'B', snapshot: { graph: edited.graph } }),
    ).edges[0]?.semanticChanged,
  ).toBe(true);
  const denied = updateEditor(
    edited,
    { type: 'NodeArchitectureChanged', id: 'b', architecture: { family: 'ddd', role: 'entity' } },
    dddRelationshipPolicy(),
  );
  expect(denied.graph).toBe(edited.graph);
  expect(denied.past).toBe(edited.past);
});
test('mixed-family policies, audits and causal controls preserve DDD meaning without causal inference', () => {
  const state = createEditor(graph(upstream)),
    edge = state.graph.edges[0];
  assert(edge);
  expect(resolveEventStormingRelationship(state.graph, edge).type).toBe('unrelated');
  expect(auditEventStormingRelationships(state.graph).entries[0]?.status).toBe('unrelated');
  const controls = resolveEventStormingRelationshipControls(state, edge.id);
  expect(controls.reason).toContain('DDD');
  expect(controls.value).toBe('ddd:strategic:upstream-downstream');
  expect(controls.choices).toHaveLength(1);
  expect(controls.choices[0]?.currentOnly).toBe(true);
  expect(
    resolveEventStormingRelationshipRequest(state, edge.id, {
      type: 'RelationshipSelected',
      edgeId: edge.id,
      key: null,
    }).type,
  ).toBe('blocked');
  const edited = updateEditor(
    state,
    {
      type: 'EdgeArchitectureChanged',
      id: edge.id,
      architecture: { family: 'ddd', scope: 'strategic', role: 'partnership' },
    },
    eventStormingRelationshipPolicy({}, dddRelationshipPolicy()),
  );
  expect(edited.graph.edges[0]?.architecture?.role).toBe('partnership');
});

test('creation, reconnection, clearing and lifecycle guards use live policy without imposing a grammar on drafts', () => {
  const value = graph(upstream),
    third = node('c', 'entity'),
    first = value.edges[0];
  assert(first);
  const state = createEditor({ nodes: [...value.nodes, third], edges: [] }),
    policy = dddRelationshipPolicy();
  const created = updateEditor(state, { type: 'ConnectionCreated', edge: first }, policy);
  expect(created.graph.edges).toHaveLength(1);
  expect(created.past).toHaveLength(1);
  const blocked = updateEditor(
    created,
    { type: 'EdgeReconnected', id: 'link', end: 'target', endpoint: { node: 'c', port: 'in' } },
    policy,
  );
  expect(blocked.graph).toBe(created.graph);
  expect(blocked.past).toBe(created.past);
  const wrong = { ...first, id: 'draft', target: { node: 'c', port: 'in' } };
  const permissive = updateEditor(state, { type: 'ConnectionCreated', edge: wrong });
  expect(permissive.graph.edges[0]?.architecture).toEqual(upstream);
  const explicit = updateEditor(state, { type: 'ConnectionCreated', edge: wrong }, policy);
  expect(explicit.graph).toBe(state.graph);
  const host = updateEditor(
    state,
    { type: 'ConnectionCreated', edge: first },
    dddRelationshipPolicy({}, { canConnect: () => 'Host connection veto' }),
  );
  expect(host.notice).toBe('Host connection veto');
  const cleared = updateEditor(
    created,
    { type: 'EdgeArchitectureChanged', id: 'link', architecture: null },
    policy,
  );
  expect(cleared.graph.edges[0]?.architecture).toBeUndefined();
  expect(cleared.past).toHaveLength(2);
  const readOnly = { ...created, readOnly: true };
  expect(
    updateEditor(
      readOnly,
      { type: 'EdgeArchitectureChanged', id: 'link', architecture: null },
      policy,
    ).graph,
  ).toBe(readOnly.graph);
});

test('invalid DDD descriptors remain decoder/editor errors and causal catalogues reject other families', () => {
  const value = graph(upstream);
  const raw = serializeGraph(value).replace('"upstream-downstream"', '"partnership"');
  expect(() => parseGraph(raw)).toThrow();
  const state = createEditor(graph());
  const invalid: DddEdgeArchitecture = {
    ...upstream,
    // @ts-expect-error Deliberately invalid runtime input exercises the public structural boundary.
    upstream: 12,
  };
  expect(() =>
    updateEditor(state, { type: 'EdgeArchitectureChanged', id: 'link', architecture: invalid }),
  ).toThrow(ZlozError);
  const dddRule = {
    architecture: { family: 'ddd' as const, scope: 'tactical' as const, role: 'emits' as const },
    sources: ['aggregate' as const],
    targets: ['domain-event' as const],
    label: 'DDD emits',
  };
  expect(() =>
    eventStormingRelationshipPolicy({
      // @ts-expect-error Runtime convention readers enforce the same family boundary as the type checker.
      rules: [dddRule],
    }),
  ).toThrow(ZlozError);
});
