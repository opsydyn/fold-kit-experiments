import { expect, test } from 'bun:test';

import {
  createArchitectureNode,
  createEditor,
  previewEventStormingDddMapping,
  serializeGraph,
  type ZlozGraph,
  type ZlozNodeArchitecture,
} from '../src/index';

const node = (id: string, architecture: ZlozNodeArchitecture) =>
  createArchitectureNode({
    id,
    label: id,
    position: { x: 0, y: 0 },
    size: { width: 200, height: 100 },
    ports: [
      { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
      { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
    ],
    architecture,
    data: { workshop: true },
  });
const edge = (id: string, source: string, target: string) => ({
  id,
  source: { node: source, port: 'out' },
  target: { node: target, port: 'in' },
});
function workshop(): ZlozGraph {
  return {
    nodes: [
      node('actor', { family: 'event-storming', role: 'actor' }),
      node('command', { family: 'event-storming', role: 'command', description: 'Place an order' }),
      node('aggregate', { family: 'ddd', role: 'aggregate-root' }),
      node('event', {
        family: 'event-storming',
        role: 'domain-event',
        description: 'Order placed',
      }),
      node('policy', { family: 'event-storming', role: 'policy' }),
      node('system', { family: 'c4', role: 'software-system' }),
    ],
    edges: [
      {
        ...edge('issues', 'actor', 'command'),
        architecture: { family: 'event-storming', role: 'issues' },
      },
      {
        ...edge('emits', 'aggregate', 'event'),
        architecture: { family: 'event-storming', role: 'emits', description: 'Fact published' },
      },
      {
        ...edge('activates', 'event', 'policy'),
        architecture: { family: 'event-storming', role: 'activates' },
      },
      edge('untyped', 'aggregate', 'event'),
      edge('outside', 'aggregate', 'system'),
    ],
  };
}

test('preview distinguishes proposals, ambiguities and unmapped intent without changing model or history', () => {
  const editor = createEditor(workshop()),
    before = serializeGraph(editor.graph);
  const preview = previewEventStormingDddMapping(editor.graph);
  expect(preview.nodes.map(({ nodeId, type }) => [nodeId, type])).toEqual([
    ['actor', 'unmapped'],
    ['command', 'ambiguous'],
    ['event', 'proposed'],
    ['policy', 'ambiguous'],
  ]);
  expect(preview.nodes.find((n) => n.nodeId === 'command')).toMatchObject({
    candidates: [
      { role: 'aggregate-root', family: 'ddd', description: 'Place an order' },
      { role: 'domain-service', family: 'ddd', description: 'Place an order' },
    ],
  });
  expect(preview.nodes.find((n) => n.nodeId === 'policy')).toMatchObject({
    type: 'ambiguous',
    candidates: [{ family: 'ddd', role: 'domain-service' }],
  });
  expect(preview.nodes.find((n) => n.nodeId === 'event')).toMatchObject({
    type: 'proposed',
    origin: 'convention',
    architecture: { family: 'ddd', role: 'domain-event', description: 'Order placed' },
  });
  expect(preview.edges.map((e) => [e.edgeId, e.type])).toEqual([
    ['issues', 'unmapped'],
    ['emits', 'proposed'],
    ['activates', 'unmapped'],
    ['untyped', 'unmapped'],
  ]);
  expect(preview.edges.find((e) => e.edgeId === 'emits')).toMatchObject({
    architecture: {
      family: 'ddd',
      scope: 'tactical',
      role: 'emits',
      description: 'Fact published',
    },
  });
  expect(preview.disclosures.map((d) => [d.kind, d.id])).toEqual([
    ['node', 'event'],
    ['edge', 'emits'],
  ]);
  expect(serializeGraph(editor.graph)).toBe(before);
  expect(editor.past).toEqual([]);
  expect(previewEventStormingDddMapping(editor.graph)).toEqual(preview);
});

test('explicit node choices resolve ambiguity; null keeps workshop intent and never infers causal meaning', () => {
  const graph = workshop();
  const preview = previewEventStormingDddMapping(graph, {
    nodes: [
      { nodeId: 'command', architecture: { family: 'ddd', role: 'domain-service' } },
      { nodeId: 'actor', architecture: null },
      { nodeId: 'policy', architecture: { family: 'ddd', role: 'domain-service' } },
    ],
    edges: [{ edgeId: 'activates', architecture: null }],
  });
  expect(preview.nodes.find((n) => n.nodeId === 'command')).toMatchObject({
    type: 'proposed',
    origin: 'explicit',
    architecture: { family: 'ddd', role: 'domain-service', description: 'Place an order' },
  });
  expect(preview.nodes.find((n) => n.nodeId === 'actor')?.type).toBe('retained');
  expect(preview.edges.find((e) => e.edgeId === 'activates')?.type).toBe('retained');
  expect(preview.edges.find((e) => e.edgeId === 'issues')?.type).toBe('unmapped');
  expect(preview.edges.find((e) => e.edgeId === 'untyped')?.type).toBe('unmapped');
  expect(graph.nodes[1]?.architecture?.family).toBe('event-storming');
});

test('explicit relationships are checked against all proposed endpoints and selected DDD conventions', () => {
  const graph = workshop();
  const compatible = previewEventStormingDddMapping(graph, {
    nodes: [{ nodeId: 'command', architecture: { family: 'ddd', role: 'domain-service' } }],
    edges: [{ edgeId: 'issues', architecture: { family: 'ddd', scope: 'tactical', role: 'uses' } }],
  });
  expect(compatible.edges.find((e) => e.edgeId === 'issues')).toMatchObject({
    type: 'blocked',
    code: 'unsupported-role',
  });
  const invalid = previewEventStormingDddMapping(graph, {
    nodes: [{ nodeId: 'event', architecture: { family: 'ddd', role: 'repository' } }],
  });
  expect(invalid.edges.find((e) => e.edgeId === 'emits')).toMatchObject({
    type: 'blocked',
    code: 'incompatible-roles',
  });
  const custom = { family: 'ddd', scope: 'tactical', role: 'custom', name: 'announces' } as const;
  const options = {
    edges: [{ edgeId: 'untyped', architecture: custom }],
    relationships: {
      rules: [
        {
          architecture: custom,
          sources: ['aggregate-root'],
          targets: ['domain-event'],
          direction: 'directed',
          label: 'Announces',
        },
      ],
    },
  } as const;
  const selected = previewEventStormingDddMapping(graph, options);
  expect(selected.edges.find((e) => e.edgeId === 'untyped')).toMatchObject({
    type: 'proposed',
    origin: 'explicit',
    architecture: custom,
  });
  expect(selected.edges.find((e) => e.edgeId === 'emits')).toMatchObject({
    type: 'blocked',
    code: 'unknown-relationship',
  });
});

test('existing DDD relationships are preserved and checked when an endpoint is mapped', () => {
  const graph = workshop();
  const authored: ZlozGraph = {
    ...graph,
    edges: [
      { ...graph.edges[1]!, architecture: { family: 'ddd', scope: 'tactical', role: 'emits' } },
    ],
  };
  const result = previewEventStormingDddMapping(authored);
  expect(result.edges[0]).toMatchObject({ type: 'retained' });
  expect(result.disclosures.map((d) => d.id)).toEqual(['event']);
  expect(() =>
    previewEventStormingDddMapping(authored, { edges: [{ edgeId: 'emits', architecture: null }] }),
  ).toThrow('Existing DDD relationships');
  const rejected = previewEventStormingDddMapping(authored, {
    nodes: [{ nodeId: 'event', architecture: { family: 'ddd', role: 'repository' } }],
  });
  expect(rejected.edges[0]).toMatchObject({ type: 'blocked', code: 'incompatible-roles' });
});

test('choices fail atomically for duplicate, missing, foreign and structurally incompatible targets', () => {
  const graph = workshop();
  for (const nodes of [
    [
      { nodeId: 'event', architecture: null },
      { nodeId: 'event', architecture: null },
    ],
    [{ nodeId: 'missing', architecture: null }],
    [{ nodeId: 'system', architecture: null }],
    [{ nodeId: 'event', architecture: { family: 'ddd', role: 'aggregate' } }],
    [{ nodeId: 'event', architecture: { family: 'ddd', role: 'actor' } }],
  ] as const) {
    // @ts-expect-error The final case deliberately violates the public DDD descriptor.
    expect(() => previewEventStormingDddMapping(graph, { nodes })).toThrow();
  }
  expect(() =>
    previewEventStormingDddMapping(graph, { edges: [{ edgeId: 'outside', architecture: null }] }),
  ).toThrow();
  expect(() =>
    previewEventStormingDddMapping(graph, {
      edges: [
        { edgeId: 'emits', architecture: null },
        { edgeId: 'emits', architecture: null },
      ],
    }),
  ).toThrow();
  expect(() =>
    previewEventStormingDddMapping({ ...graph, nodes: [...graph.nodes, graph.nodes[0]!] }),
  ).toThrow();
});

test('descriptors and directional role arrays are detached from graph and supplied choices', () => {
  const graph = workshop();
  const upstream: ('open-host-service' | 'published-language')[] = ['published-language'];
  const architecture = {
    family: 'ddd',
    scope: 'strategic',
    role: 'upstream-downstream',
    upstream,
  } as const;
  const preview = previewEventStormingDddMapping(graph, {
    nodes: [
      {
        nodeId: 'command',
        architecture: { family: 'ddd', role: 'bounded-context', description: 'Sales' },
      },
      { nodeId: 'actor', architecture: { family: 'ddd', role: 'bounded-context' } },
    ],
    edges: [{ edgeId: 'issues', architecture }],
  });
  upstream.push('open-host-service');
  const proposed = preview.edges.find((e) => e.edgeId === 'issues');
  expect(proposed).toMatchObject({
    type: 'proposed',
    architecture: { upstream: ['published-language'] },
  });
  expect(preview.nodes.find((n) => n.nodeId === 'command')).toMatchObject({
    architecture: { description: 'Sales' },
    sourceArchitecture: { description: 'Place an order' },
  });
  expect(preview.nodes[0]?.sourceArchitecture).not.toBe(graph.nodes[0]?.architecture);
});

test('empty and unrelated graphs remain empty previews; retained nodes block implicit edge proposals', () => {
  expect(previewEventStormingDddMapping({ nodes: [], edges: [] })).toEqual({
    nodes: [],
    edges: [],
    disclosures: [],
  });
  const preview = previewEventStormingDddMapping(workshop(), {
    nodes: [{ nodeId: 'event', architecture: null }],
  });
  expect(preview.edges.find((e) => e.edgeId === 'emits')).toMatchObject({
    type: 'blocked',
    code: 'unsupported-role',
  });
  expect(preview.disclosures).toEqual([]);
});

test('custom causal meaning is never inferred and invalid choices/catalogues reject even on empty scope', () => {
  const graph = workshop();
  const custom: ZlozGraph = {
    ...graph,
    edges: [
      {
        ...graph.edges[1]!,
        architecture: { family: 'event-storming', role: 'custom', name: 'emits' },
      },
    ],
  };
  expect(previewEventStormingDddMapping(custom).edges[0]?.type).toBe('unmapped');
  expect(() =>
    previewEventStormingDddMapping(graph, {
      edges: [
        // @ts-expect-error Causal descriptors are not DDD relationship choices.
        { edgeId: 'emits', architecture: { family: 'event-storming', role: 'emits' } },
      ],
    }),
  ).toThrow('valid DDD relationship');
  expect(() =>
    previewEventStormingDddMapping(
      { nodes: [], edges: [] },
      {
        relationships: {
          rules: [
            {
              architecture: { family: 'ddd', scope: 'tactical', role: 'uses' },
              sources: ['bounded-context'],
              targets: ['domain-event'],
              direction: 'directed',
              label: 'Invalid',
            },
          ],
        },
      },
    ),
  ).toThrow('tactical or strategic scope');
});

test('explicit edge mappings inherit source descriptions unless deliberately replaced', () => {
  const graph = workshop();
  const architecture = { family: 'ddd', scope: 'tactical', role: 'emits' } as const;
  const inherited = previewEventStormingDddMapping(graph, {
    edges: [{ edgeId: 'emits', architecture }],
  });
  expect(inherited.edges.find((e) => e.edgeId === 'emits')).toMatchObject({
    type: 'proposed',
    origin: 'explicit',
    architecture: { ...architecture, description: 'Fact published' },
  });
  const replaced = previewEventStormingDddMapping(graph, {
    edges: [{ edgeId: 'emits', architecture: { ...architecture, description: '' } }],
  });
  expect(replaced.edges.find((e) => e.edgeId === 'emits')).toMatchObject({
    architecture: { description: '' },
    sourceArchitecture: { description: 'Fact published' },
  });
  expect(replaced.disclosures).toContainEqual({
    kind: 'edge',
    id: 'emits',
    code: 'workshop-meaning-replaced',
    reason:
      'Conversion would replace the reserved causal descriptor with DDD meaning; this is not a lossless semantic equivalence.',
  });
});
