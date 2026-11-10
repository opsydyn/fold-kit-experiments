import { expect, test } from 'bun:test';

import {
  createEventStormingPattern,
  resolveEventStormingRelationship,
  eventStormingRelationshipPolicy,
  createEditor,
  updateEditor,
  parseGraph,
  serializeGraph,
  captureEdition,
  compareEditions,
  type ZlozEdge,
} from '../src/index';
const graph = () => createEventStormingPattern({ includeAggregate: true });
test('default causal vocabulary covers the aggregate process and infers legacy edges', () => {
  const value = graph();
  expect(value.nodes.map((node) => node.architecture?.role)).toEqual([
    'actor',
    'command',
    'aggregate-root',
    'domain-event',
    'policy',
    'command',
  ]);
  expect(value.edges.map((edge) => edge.architecture?.role)).toEqual([
    'issues',
    'handles',
    'emits',
    'activates',
    'triggers',
  ]);
  for (const edge of value.edges) {
    expect(resolveEventStormingRelationship(value, edge).type).toBe('allowed');
    const { architecture: _architecture, ...legacy } = edge;
    const inferred = resolveEventStormingRelationship(value, legacy);
    expect(inferred.type).toBe('allowed');
    if (inferred.type === 'allowed') expect(edge.architecture).toEqual(inferred.architecture);
  }
});
test('incompatible and ambiguous relations explain rejection; custom rules and role mapping are first class', () => {
  const value = graph();
  const edge = value.edges[0];
  if (!edge) throw new Error('Missing edge');
  const wrong = {
    ...edge,
    architecture: { family: 'event-storming' as const, role: 'emits' as const },
  };
  expect(resolveEventStormingRelationship(value, wrong).type).toBe('blocked');
  const custom = { family: 'event-storming' as const, role: 'custom' as const, name: 'requests' };
  const rules = [
    {
      architecture: custom,
      sources: ['actor' as const],
      targets: ['command' as const],
      label: 'Requests',
    },
  ];
  expect(
    resolveEventStormingRelationship(value, { ...edge, architecture: custom }, { rules }).type,
  ).toBe('allowed');
  const { architecture: _architecture, ...legacy } = edge;
  const inferred = resolveEventStormingRelationship(value, legacy, { rules });
  if (inferred.type !== 'allowed') throw new Error('Custom inference blocked');
  expect(inferred.architecture).toEqual(custom);
  const ambiguous = resolveEventStormingRelationship(value, legacy, {
    rules: [
      ...rules,
      {
        architecture: { ...custom, name: 'approves' },
        sources: ['actor'],
        targets: ['command'],
        label: 'Approves',
      },
    ],
  });
  expect(ambiguous.type).toBe('blocked');
  if (ambiguous.type === 'blocked') expect(ambiguous.code).toBe('ambiguous-relationship');
  expect(() =>
    resolveEventStormingRelationship(value, edge, { rules: [...rules, ...rules] }),
  ).toThrow();
});
test('syntax roundtrips, Undo and semantic history retain typed metadata without claiming conversion fidelity', () => {
  const value = graph();
  expect(parseGraph(serializeGraph(value))).toEqual(value);
  const state = createEditor(value);
  const edge = value.edges[0];
  if (!edge) throw new Error('Missing edge');
  const changed = updateEditor(state, {
    type: 'EdgeArchitectureChanged',
    id: edge.id,
    architecture: { family: 'event-storming', role: 'custom', name: 'approves' },
  });
  expect(changed.past).toHaveLength(1);
  expect(changed.routes).toBe(state.routes);
  expect(updateEditor(changed, { type: 'UndoPressed' }).graph).toEqual(value);
  const before = captureEdition({ id: 'a', name: 'A', snapshot: { graph: value } }),
    after = captureEdition({ id: 'b', name: 'B', snapshot: { graph: changed.graph } });
  expect(compareEditions(before, after).edges[0]?.semanticChanged).toBe(true);
  expect(compareEditions(before, after).edges[0]?.layoutChanged).toBe(false);
  expect(() =>
    parseGraph(
      JSON.stringify({
        version: 1,
        graph: {
          ...value,
          edges: [
            { ...edge, architecture: { family: 'event-storming', role: 'custom', name: '' } },
          ],
        },
      }),
    ),
  ).toThrow();
});
test('opt-in policies compose vetoes and protect edge metadata and incident node-role edits', () => {
  const value = graph(),
    state = createEditor(value),
    edge = value.edges[0];
  if (!edge) throw new Error('Missing edge');
  const policy = eventStormingRelationshipPolicy();
  const rejected = updateEditor(
    state,
    {
      type: 'EdgeArchitectureChanged',
      id: edge.id,
      architecture: { family: 'event-storming', role: 'emits' },
    },
    policy,
  );
  expect(rejected.graph).toBe(state.graph);
  expect(rejected.past).toHaveLength(0);
  expect(rejected.notice?.length ?? 0).toBeGreaterThan(0);
  expect(
    updateEditor(
      state,
      {
        type: 'NodeArchitectureChanged',
        id: edge.source.node,
        architecture: { family: 'event-storming', role: 'policy' },
      },
      policy,
    ).graph,
  ).toBe(state.graph);
  const protectedPolicy = eventStormingRelationshipPolicy(
    {},
    { canChangeEdgeArchitecture: () => 'Managed relationship' },
  );
  expect(
    updateEditor(
      state,
      { type: 'EdgeArchitectureChanged', id: edge.id, architecture: null },
      protectedPolicy,
    ).notice,
  ).toBe('Managed relationship');
  expect(
    updateEditor(
      { ...state, readOnly: true },
      { type: 'EdgeArchitectureChanged', id: edge.id, architecture: null },
    ).graph,
  ).toBe(state.graph);
});

test('creation and reconnection use the same convention while structural port protections retain precedence', () => {
  const value = graph(),
    state = createEditor(value),
    policy = eventStormingRelationshipPolicy();
  const edge = value.edges[0];
  if (!edge) throw new Error('Missing edge');
  const proposal: ZlozEdge = {
    id: 'candidate',
    source: { node: 'note:1', port: 'out' },
    target: { node: 'note:5', port: 'in' },
    architecture: { family: 'event-storming', role: 'custom', name: 'delegates' },
  };
  const rejected = updateEditor(state, { type: 'ConnectionCreated', edge: proposal }, policy);
  expect(rejected.graph).toBe(state.graph);
  expect(rejected.past).toHaveLength(0);
  const custom = eventStormingRelationshipPolicy({
    rules: [
      {
        architecture: { family: 'event-storming', role: 'custom', name: 'delegates' },
        sources: ['command'],
        targets: ['command'],
        label: 'Delegates',
      },
    ],
  });
  const created = updateEditor(state, { type: 'ConnectionCreated', edge: proposal }, custom);
  expect(created.graph.edges.at(-1)?.architecture).toEqual(proposal.architecture);
  expect(created.past).toHaveLength(1);
  expect(updateEditor(created, { type: 'UndoPressed' }).graph).toEqual(state.graph);
  const locked = eventStormingRelationshipPolicy({}, { canConnectPort: () => 'Port is managed' });
  expect(updateEditor(state, { type: 'ConnectionCreated', edge: proposal }, locked).notice).toBe(
    'Port is managed',
  );
  const rewired = updateEditor(
    state,
    {
      type: 'EdgeReconnected',
      id: edge.id,
      end: 'source',
      endpoint: { node: 'note:4', port: 'out' },
    },
    policy,
  );
  expect(rewired.graph).toBe(state.graph);
  expect(rewired.notice).toContain('issues');
  const host = eventStormingRelationshipPolicy({}, { canConnect: () => 'Workspace protected' });
  expect(host.canConnect?.(proposal, value)).toBe('Workspace protected');
});
test('strict wire descriptors reject unknown fields while legacy edges and custom node interpretation remain usable', () => {
  const value = graph(),
    first = value.edges[0];
  if (!first) throw new Error('Missing edge');
  for (const architecture of [
    { family: 'event-storming', role: 'unknown' },
    { family: 'event-storming', role: 'issues', name: 'wrong' },
    { family: 'event-storming', role: 'custom', name: '  ' },
    { family: 'event-storming', role: 'issues', description: 23 },
  ]) {
    expect(() =>
      parseGraph(
        JSON.stringify({ version: 1, graph: { ...value, edges: [{ ...first, architecture }] } }),
      ),
    ).toThrow();
  }
  const { architecture: _edge, ...untyped } = first;
  const plain = {
    ...value,
    nodes: value.nodes.map((node) => {
      const { architecture: _node, ...without } = node;
      return without;
    }),
  };
  expect(resolveEventStormingRelationship(plain, untyped)).toEqual({ type: 'unrelated' });
  expect(resolveEventStormingRelationship(plain, first).type).toBe('blocked');
  const interpreted = resolveEventStormingRelationship(plain, untyped, {
    roleOf: (node) => (node.id === 'note:0' ? 'actor' : 'command'),
  });
  expect(interpreted.type).toBe('allowed');
  const same = createEditor(value);
  expect(
    updateEditor(same, {
      type: 'EdgeArchitectureChanged',
      id: first.id,
      architecture: { role: 'issues', family: 'event-storming' },
    }),
  ).toBe(same);
  const removed = updateEditor(same, {
    type: 'EdgeArchitectureChanged',
    id: first.id,
    architecture: null,
  });
  expect(removed.graph.edges[0]?.architecture).toBeUndefined();
  expect(updateEditor(removed, { type: 'RedoPressed' }).graph).toBe(removed.graph);
  expect(
    updateEditor(updateEditor(removed, { type: 'UndoPressed' }), { type: 'RedoPressed' }).graph,
  ).toEqual(removed.graph);
});
