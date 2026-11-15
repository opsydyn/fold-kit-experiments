/* oxlint-disable anti-slop/no-shape-in-symbol-names -- These tests exercise geometric node shape fields from the public contract. */
import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  resolveDeclaredConsumption,
  isDeclaredConsumption,
  createArchitectureNode,
  isNodeArchitecture,
  isDddEdgeArchitecture,
  resolveDddRelationship,
  dddRelationshipPolicy,
  resolveDddRelationshipControls,
  resolveDddRelationshipRequest,
  createEditor,
  updateEditor,
  parseGraph,
  serializeGraph,
  captureEdition,
  compareEditions,
  writeSvgExport,
  type ZlozNode,
  type DddNodeArchitecture,
  type ZlozGraph,
} from '../src/index';
function node(id: string, role: DddNodeArchitecture['role']): ZlozNode {
  return createArchitectureNode({
    id,
    label: id,
    position: { x: id === 'source' ? 0 : 300, y: 0 },
    size: { width: 200, height: 100 },
    ports: [
      { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
      { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
    ],
    architecture: { family: 'ddd', role },
  });
}
const feeds = { family: 'ddd', scope: 'tactical', role: 'feeds' } as const;
function graph(role: DddNodeArchitecture['role'] = 'aggregate-root'): ZlozGraph {
  return {
    nodes: [node('source', role), node('consumer', 'read-model')],
    edges: [
      {
        id: 'feed',
        source: { node: 'source', port: 'out' },
        target: { node: 'consumer', port: 'in' },
      },
    ],
  };
}
test('read-model and feeds are strict first-class descriptors, not executable handlers or group roles', () => {
  expect(isNodeArchitecture({ family: 'ddd', role: 'read-model' })).toBe(true);
  expect(isDddEdgeArchitecture(feeds)).toBe(true);
  expect(node('consumer', 'read-model').appearance?.shape).toBe('rounded-rectangle');
  expect(isNodeArchitecture({ family: 'ddd', role: 'read-model', handler: 'run' })).toBe(false);
  expect(isDddEdgeArchitecture({ ...feeds, events: ['Deposited'] })).toBe(false);
  expect(isDddEdgeArchitecture({ ...feeds, scope: 'strategic' })).toBe(false);
  expect(() =>
    createArchitectureNode({
      ...node('consumer', 'read-model'),
      kind: 'group',
      ports: [],
      architecture: { family: 'ddd', role: 'read-model' },
    }),
  ).toThrow();
  expect(isDeclaredConsumption({ sourceNodeId: 'a', consumerNodeId: 'b' })).toBe(true);
  for (const invalid of [
    null,
    [],
    { sourceNodeId: '', consumerNodeId: 'b' },
    { sourceNodeId: 'a', consumerNodeId: ' ' },
    { sourceNodeId: 'a', consumerNodeId: 'b', runtime: true },
  ])
    expect(isDeclaredConsumption(invalid)).toBe(false);
});
test('pure resolution distinguishes declared source kinds without inferring events, delivery or mutating graph', () => {
  for (const role of ['aggregate', 'aggregate-root', 'domain-event', 'read-model'] as const) {
    const source =
      role === 'aggregate'
        ? createArchitectureNode({
            ...node('source', 'aggregate-root'),
            kind: 'group',
            appearance: { shape: 'rectangle' },
            ports: [],
            architecture: { family: 'ddd', role: 'aggregate' },
          })
        : node('source', role);
    const value = { nodes: [source, node('consumer', 'read-model')], edges: [] };
    const before = JSON.stringify(value),
      declaration = { sourceNodeId: 'source', consumerNodeId: 'consumer' };
    const result = resolveDeclaredConsumption(value, declaration);
    assert(result.type === 'allowed');
    expect(result.sourceRole).toBe(role);
    expect(result.relationship).toEqual({
      sourceNodeId: 'source',
      targetNodeId: 'consumer',
      architecture: feeds,
    });
    expect(result.declaration).toEqual(declaration);
    expect(result.declaration).not.toBe(declaration);
    expect(Object.isFrozen(result.declaration)).toBe(true);
    expect(Object.isFrozen(result.relationship.architecture)).toBe(true);
    expect('events' in result).toBe(false);
    expect(JSON.stringify(value)).toBe(before);
  }
});
test('logical consumption fails explicitly for missing nodes, reversed roles and unsupported producers', () => {
  const value = graph();
  expect(
    resolveDeclaredConsumption(value, { sourceNodeId: 'missing', consumerNodeId: 'consumer' }),
  ).toMatchObject({ type: 'blocked', code: 'missing-node' });
  expect(
    resolveDeclaredConsumption(value, { sourceNodeId: 'consumer', consumerNodeId: 'source' }),
  ).toMatchObject({ type: 'blocked', code: 'incompatible-roles' });
  for (const role of [
    'entity',
    'value-object',
    'domain-service',
    'repository',
    'bounded-context',
  ] as const)
    expect(
      resolveDeclaredConsumption(graph(role), {
        sourceNodeId: 'source',
        consumerNodeId: 'consumer',
      }),
    ).toMatchObject({ type: 'blocked', code: 'incompatible-roles' });
  expect(
    resolveDeclaredConsumption(
      {
        nodes: [
          {
            ...node('source', 'domain-event'),
            architecture: { family: 'event-storming', role: 'domain-event' },
          },
          node('consumer', 'read-model'),
        ],
        edges: [],
      },
      { sourceNodeId: 'source', consumerNodeId: 'consumer' },
    ),
  ).toMatchObject({ type: 'blocked', code: 'unsupported-role' });
  expect(
    resolveDeclaredConsumption(value, { sourceNodeId: ' ', consumerNodeId: 'consumer' }),
  ).toMatchObject({ type: 'blocked', code: 'invalid-descriptor' });
  expect(
    resolveDddRelationship(value, {
      sourceNodeId: 'source',
      targetNodeId: 'consumer',
      architecture: feeds,
    }).type,
  ).toBe('allowed');
});
test('literal v1 read models and feeds round-trip, participate in editions and export without inventing runtime data', () => {
  const literal =
    '{"version":1,"graph":{"nodes":[{"id":"event","label":"Deposited","position":{"x":0,"y":0},"size":{"width":200,"height":100},"ports":[{"id":"out","kind":"output","side":"right","offset":0.5}],"architecture":{"family":"ddd","role":"domain-event"}},{"id":"balance","label":"Balance","position":{"x":300,"y":0},"size":{"width":200,"height":100},"ports":[{"id":"in","kind":"input","side":"left","offset":0.5}],"architecture":{"family":"ddd","role":"read-model"}}],"edges":[{"id":"feed","source":{"node":"event","port":"out"},"target":{"node":"balance","port":"in"},"architecture":{"family":"ddd","scope":"tactical","role":"feeds"}}]}}';
  const value = parseGraph(literal);
  expect(parseGraph(serializeGraph(value))).toEqual(value);
  expect(
    resolveDeclaredConsumption(value, { sourceNodeId: 'event', consumerNodeId: 'balance' }).type,
  ).toBe('allowed');
  const before = captureEdition({
      id: 'before',
      name: 'Before',
      snapshot: { graph: { ...value, edges: [] } },
    }),
    after = captureEdition({ id: 'after', name: 'After', snapshot: { graph: value } });
  expect(compareEditions(before, after).edges.map((e) => ({ id: e.id, kind: e.kind }))).toEqual([
    { id: 'feed', kind: 'added' },
  ]);
  const svg = writeSvgExport(
    { graph: value },
    {
      title: 'Consumption',
      region: { type: 'model', padding: 24 },
      theme: { colorScheme: 'light' },
      background: { type: 'theme' },
      font: { family: 'sans-serif', size: 14, weight: 400 },
      renderers: { nodes: 'built-in', edges: 'built-in' },
    },
    { allowLosses: true },
  );
  assert(svg.type === 'written');
  expect(svg.svg).toContain('Balance');
  expect(svg.findings.some((f) => f.code === 'semantic-edge-fallback')).toBe(true);
});

test('native DDD controls expose explicit consumption and recheck live protection, revision and incident changes with one Undo', () => {
  const initial = createEditor(graph()),
    policy = dddRelationshipPolicy();
  const controls = resolveDddRelationshipControls(initial, 'feed', { policy });
  const choice = controls.pattern.choices.find((c) => c.key === 'tactical:feeds');
  assert(choice);
  expect(choice.compatibilityReason).toBeNull();
  const request = {
    type: 'PatternSelected',
    edgeId: 'feed',
    revision: initial.revision,
    key: 'tactical:feeds',
  } as const;
  const edit = resolveDddRelationshipRequest(initial, 'feed', request, { policy });
  assert(edit.type === 'ready');
  const changed = updateEditor(initial, edit.event, policy);
  expect(changed.graph.edges[0]?.architecture).toEqual(feeds);
  expect(changed.past).toHaveLength(1);
  expect(updateEditor(changed, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  expect(
    updateEditor(updateEditor(changed, { type: 'UndoPressed' }), { type: 'RedoPressed' }).graph,
  ).toEqual(changed.graph);
  const protectedPolicy = dddRelationshipPolicy(
    {},
    { canChangeEdgeArchitecture: () => 'Managed projection' },
  );
  expect(
    resolveDddRelationshipRequest(initial, 'feed', request, { policy: protectedPolicy }),
  ).toEqual({ type: 'blocked', reason: 'Managed projection' });
  expect(
    resolveDddRelationshipRequest({ ...initial, readOnly: true }, 'feed', request, { policy }).type,
  ).toBe('blocked');
  expect(resolveDddRelationshipRequest(changed, 'feed', request, { policy }).type).toBe('ignored');
  const incompatible = updateEditor(
    changed,
    {
      type: 'NodeArchitectureChanged',
      id: 'consumer',
      architecture: { family: 'ddd', role: 'repository' },
    },
    policy,
  );
  expect(incompatible.graph).toBe(changed.graph);
  expect(incompatible.past).toBe(changed.past);
  const edge = changed.graph.edges[0];
  assert(edge);
  const connection = {
    ...edge,
    id: 'invalid',
    target: { node: 'source', port: 'in' },
  };
  const rejected = updateEditor(initial, { type: 'ConnectionCreated', edge: connection }, policy);
  expect(rejected.graph).toBe(initial.graph);
});
test('query-oriented roles stay authored: self-dependencies are explicit and cannot manufacture a source event set', () => {
  const value = { nodes: [node('self', 'read-model')], edges: [] };
  const result = resolveDeclaredConsumption(value, {
    sourceNodeId: 'self',
    consumerNodeId: 'self',
  });
  assert(result.type === 'allowed');
  expect(result.sourceRole).toBe('read-model');
  expect(result.relationship.architecture).toEqual(feeds);
  const guard = Object.create({ sourceNodeId: 'self', consumerNodeId: 'self' });
  expect(isDeclaredConsumption(guard)).toBe(false);
});
