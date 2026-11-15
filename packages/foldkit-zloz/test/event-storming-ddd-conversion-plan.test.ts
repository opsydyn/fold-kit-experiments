import { expect, test } from 'bun:test';

import {
  captureEdition,
  createArchitectureNode,
  createEditor,
  createEventStormingDddConversionPlan,
  resolveEventStormingDddConversionConsent,
  serializeModelDocument,
  parseModelDocument,
  type ZlozEventStormingDddConversionSource,
  type ZlozEventStormingDddMappingOptions,
  type ZlozGraph,
} from '../src/index';
const node = (id: string) =>
  createArchitectureNode({
    id,
    label: id,
    position: { x: 10, y: 20 },
    size: { width: 200, height: 120 },
    ports: [
      { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
      { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
    ],
    architecture: { family: 'event-storming', role: 'domain-event', description: `Workshop ${id}` },
    data: { owner: 'workshop', version: 1 },
  });
function source(): ZlozEventStormingDddConversionSource {
  const graph: ZlozGraph = {
    nodes: [
      { ...node('aggregate'), architecture: { family: 'ddd', role: 'aggregate-root' } },
      node('event'),
    ],
    edges: [
      {
        id: 'emits',
        label: 'Fact published',
        source: { node: 'aggregate', port: 'out' },
        target: { node: 'event', port: 'in' },
        architecture: { family: 'event-storming', role: 'emits', description: 'Workshop emission' },
        data: { original: true },
      },
    ],
  };
  const original = captureEdition({ id: 'discovery', name: 'Workshop', snapshot: { graph } });
  return {
    sessionId: 'tab:orders:1',
    revision: 4,
    document: {
      id: 'orders',
      name: 'Orders',
      snapshot: { graph, viewport: { x: 20, y: 10, zoom: 1 } },
      editions: [original],
      origin: { modelId: 'discovery-model', modelName: 'Discovery', edition: original },
    },
  };
}

test('reviewable plans retain detached source provenance and same-ID descriptor changes without editing', () => {
  const input = source(),
    before = serializeModelDocument(input.document),
    editor = createEditor(input.document.snapshot.graph);
  const plan = createEventStormingDddConversionPlan(input);
  expect(plan.type).toBe('reviewable');
  if (plan.type !== 'reviewable') throw new Error('Expected reviewable fixture');
  expect(plan.provenance).toEqual(input);
  expect(plan.provenance.document).not.toBe(input.document);
  expect(plan.changes.nodes).toMatchObject([
    {
      nodeId: 'event',
      architecture: { family: 'ddd', role: 'domain-event', description: 'Workshop event' },
      sourceArchitecture: { family: 'event-storming', role: 'domain-event' },
    },
  ]);
  expect(plan.changes.edges).toMatchObject([
    {
      edgeId: 'emits',
      architecture: {
        family: 'ddd',
        scope: 'tactical',
        role: 'emits',
        description: 'Workshop emission',
      },
    },
  ]);
  expect(plan.preview.disclosures.map((loss) => [loss.kind, loss.id])).toEqual([
    ['node', 'event'],
    ['edge', 'emits'],
  ]);
  expect(Object.isFrozen(plan)).toBe(true);
  expect(Object.isFrozen(plan.changes.nodes[0]?.architecture)).toBe(true);
  expect(Object.isFrozen(plan.provenance.document.snapshot.graph.nodes)).toBe(true);
  expect(createEventStormingDddConversionPlan(input).key).toBe(plan.key);
  expect(createEventStormingDddConversionPlan(input, plan.mappings).key).toBe(plan.key);
  expect(serializeModelDocument(input.document)).toBe(before);
  expect(editor.past).toEqual([]);
});

test('consent is explicit, all-loss and tied to freshly recomputed source and plan content', () => {
  const input = source(),
    plan = createEventStormingDddConversionPlan(input);
  expect(resolveEventStormingDddConversionConsent(input).type).toBe('consent-required');
  expect(
    resolveEventStormingDddConversionConsent(input, {}, { planKey: plan.key, accepted: true }).type,
  ).toBe('consented');
  expect(
    resolveEventStormingDddConversionConsent(
      input,
      {},
      { planKey: plan.key + 'other', accepted: true },
    ).type,
  ).toBe('consent-required');
  expect(
    resolveEventStormingDddConversionConsent(
      input,
      {},
      {
        planKey: plan.key,
        // @ts-expect-error A false value is revocation, not affirmative loss consent.
        accepted: false,
      },
    ).type,
  ).toBe('consent-required');
  expect(resolveEventStormingDddConversionConsent(input, {}, null).type).toBe('consent-required');
});

test('scope, identity, graph, camera, editions and ancestry changes invalidate earlier consent', () => {
  const input = source(),
    plan = createEventStormingDddConversionPlan(input),
    document = input.document;
  const variants: readonly ZlozEventStormingDddConversionSource[] = [
    { ...input, sessionId: 'another-tab' },
    { ...input, revision: 5 },
    { ...input, document: { ...document, id: 'another-model' } },
    { ...input, document: { ...document, name: 'Renamed' } },
    {
      ...input,
      document: {
        ...document,
        snapshot: { ...document.snapshot, viewport: { x: 0, y: 0, zoom: 1 } },
      },
    },
    {
      ...input,
      document: {
        ...document,
        snapshot: {
          ...document.snapshot,
          graph: {
            ...document.snapshot.graph,
            nodes: document.snapshot.graph.nodes.map((n) => ({
              ...n,
              label: n.label + ' changed',
            })),
          },
        },
      },
    },
    { ...input, document: { ...document, editions: [] } },
    { ...input, document: { ...document, origin: null } },
  ];
  for (const changed of variants) {
    const decision = resolveEventStormingDddConversionConsent(
      changed,
      {},
      { planKey: plan.key, accepted: true },
    );
    expect(decision.type).toBe('consent-required');
    expect(decision.plan.key).not.toBe(plan.key);
  }
});

test('choices, targets and effective conventions invalidate consent even when loss IDs stay the same', () => {
  const input = source(),
    plan = createEventStormingDddConversionPlan(input);
  const variants: readonly ZlozEventStormingDddMappingOptions[] = [
    { nodes: [{ nodeId: 'event', architecture: { family: 'ddd', role: 'domain-event' } }] },
    {
      nodes: [
        {
          nodeId: 'event',
          architecture: { family: 'ddd', role: 'domain-event', description: 'Refined fact' },
        },
      ],
    },
    {
      relationships: {
        rules: [
          {
            architecture: { family: 'ddd', scope: 'tactical', role: 'emits' },
            sources: ['aggregate-root'],
            targets: ['domain-event'],
            label: 'Custom convention label',
            direction: 'directed',
          },
        ],
      },
    },
  ];
  for (const options of variants) {
    const decision = resolveEventStormingDddConversionConsent(input, options, {
      planKey: plan.key,
      accepted: true,
    });
    expect(decision.type).toBe('consent-required');
    expect(decision.plan.preview.disclosures.map((loss) => loss.id)).toEqual(['event', 'emits']);
  }
});

test('unresolved mappings block the whole plan and cannot be bypassed by accepting its losses', () => {
  const input = source();
  const graph = {
    ...input.document.snapshot.graph,
    nodes: [
      ...input.document.snapshot.graph.nodes,
      {
        ...node('command'),
        architecture: { family: 'event-storming' as const, role: 'command' as const },
      },
      {
        ...node('actor'),
        architecture: { family: 'event-storming' as const, role: 'actor' as const },
      },
    ],
    edges: [
      ...input.document.snapshot.graph.edges,
      {
        id: 'unknown',
        source: { node: 'aggregate', port: 'out' },
        target: { node: 'command', port: 'in' },
      },
    ],
  };
  const mixed = { ...input, document: { ...input.document, snapshot: { graph } } };
  const plan = createEventStormingDddConversionPlan(mixed);
  expect(plan.type).toBe('blocked');
  if (plan.type !== 'blocked') throw new Error('Expected unresolved fixture');
  expect(plan.blockers.map((item) => [item.kind, item.id, item.decision])).toEqual([
    ['node', 'command', 'ambiguous'],
    ['node', 'actor', 'unmapped'],
    ['edge', 'unknown', 'unmapped'],
  ]);
  expect('changes' in plan).toBe(false);
  expect(
    resolveEventStormingDddConversionConsent(mixed, {}, { planKey: plan.key, accepted: true }).type,
  ).toBe('blocked');
  const resolved = createEventStormingDddConversionPlan(mixed, {
    nodes: [
      { nodeId: 'command', architecture: null },
      { nodeId: 'actor', architecture: null },
    ],
    edges: [{ edgeId: 'unknown', architecture: null }],
  });
  expect(resolved.type).toBe('reviewable');
});

test('incompatible DDD proposals remain blockers and explicit retention can produce an unchanged plan', () => {
  const input = source();
  const blocked = createEventStormingDddConversionPlan(input, {
    nodes: [{ nodeId: 'event', architecture: { family: 'ddd', role: 'repository' } }],
  });
  expect(blocked.type).toBe('blocked');
  if (blocked.type !== 'blocked') throw new Error('Expected incompatible fixture');
  expect(blocked.blockers).toMatchObject([
    {
      kind: 'edge',
      id: 'emits',
      decision: 'blocked',
      reason: 'This convention does not allow tactical:emits from aggregate-root to repository.',
    },
  ]);
  const retain: ZlozEventStormingDddMappingOptions = {
    nodes: [{ nodeId: 'event', architecture: null }],
    edges: [{ edgeId: 'emits', architecture: null }],
  };
  const unchanged = resolveEventStormingDddConversionConsent(input, retain);
  expect(unchanged.type).toBe('unchanged');
  expect(unchanged.plan.preview.disclosures).toEqual([]);
});

test('plan data and convention role arrays cannot alias caller-owned descriptors', () => {
  const input = source(),
    payload = { note: 'original' };
  const graph = {
    nodes: [node('left'), { ...node('right'), data: payload }],
    edges: [
      {
        id: 'between',
        source: { node: 'left', port: 'out' },
        target: { node: 'right', port: 'in' },
      },
    ],
  };
  const current = { ...input, document: { ...input.document, snapshot: { graph } } };
  const upstream: ('open-host-service' | 'published-language')[] = ['published-language'];
  const targets: 'bounded-context'[] = ['bounded-context'];
  const architecture = {
    family: 'ddd',
    scope: 'strategic',
    role: 'upstream-downstream',
    upstream,
  } as const;
  const options: ZlozEventStormingDddMappingOptions = {
    nodes: [
      { nodeId: 'left', architecture: { family: 'ddd', role: 'bounded-context' } },
      { nodeId: 'right', architecture: { family: 'ddd', role: 'bounded-context' } },
    ],
    edges: [{ edgeId: 'between', architecture }],
    relationships: {
      rules: [
        {
          architecture,
          sources: ['bounded-context'],
          targets,
          label: 'Influences',
          direction: 'directed',
        },
      ],
    },
  };
  const plan = createEventStormingDddConversionPlan(current, options),
    key = plan.key;
  upstream.push('open-host-service');
  targets.push('bounded-context');
  payload.note = 'changed';
  expect(plan.provenance.document.snapshot.graph.nodes.find((n) => n.id === 'right')?.data).toEqual(
    { note: 'original' },
  );
  expect(plan.mappings.edges?.[0]?.architecture).toMatchObject({
    upstream: ['published-language'],
  });
  expect(plan.mappings.relationships?.rules?.[0]?.targets).toEqual(['bounded-context']);
  expect(plan.key).toBe(key);
  expect(Object.isFrozen(plan.mappings.edges?.[0]?.architecture)).toBe(true);
});

test('invalid source scope/documents/choices/catalogues reject before returning any plan', () => {
  const input = source();
  for (const revision of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1])
    expect(() => createEventStormingDddConversionPlan({ ...input, revision })).toThrow('revision');
  expect(() => createEventStormingDddConversionPlan({ ...input, sessionId: ' ' })).toThrow(
    'session',
  );
  expect(() =>
    createEventStormingDddConversionPlan({ ...input, document: { ...input.document, id: '' } }),
  ).toThrow();
  expect(() =>
    createEventStormingDddConversionPlan(input, {
      nodes: [{ nodeId: 'missing', architecture: null }],
    }),
  ).toThrow();
  expect(() =>
    createEventStormingDddConversionPlan(input, {
      edges: [
        { edgeId: 'emits', architecture: null },
        { edgeId: 'emits', architecture: null },
      ],
    }),
  ).toThrow();
  expect(() =>
    createEventStormingDddConversionPlan(input, {
      relationships: {
        rules: [
          {
            architecture: { family: 'ddd', scope: 'tactical', role: 'emits' },
            sources: ['bounded-context'],
            targets: ['domain-event'],
            label: 'Bad',
            direction: 'directed',
          },
        ],
      },
    }),
  ).toThrow();
});

test('empty sources need no consent, and provenance can be reconstructed with the existing document codec', () => {
  const input = source(),
    empty = {
      ...input,
      document: { ...input.document, snapshot: { graph: { nodes: [], edges: [] } } },
    };
  expect(resolveEventStormingDddConversionConsent(empty).type).toBe('unchanged');
  const plan = createEventStormingDddConversionPlan(input);
  expect(serializeModelDocument(plan.provenance.document)).toBe(
    serializeModelDocument(input.document),
  );
  expect(parseModelDocument(serializeModelDocument(plan.provenance.document))).toEqual(
    input.document,
  );
});
