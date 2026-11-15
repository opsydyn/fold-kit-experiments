import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  captureEdition,
  createEditor,
  parseGraph,
  previewEventStormingC4Mapping,
  serializeModelDocument,
  type ZlozEventStormingC4Source,
  type ZlozEventStormingC4MappingOptions,
} from '../src/index';
import wire from './fixtures/workshop-v1.json';
function source(): ZlozEventStormingC4Source {
  const graph = parseGraph(JSON.stringify(wire));
  const snapshot = { graph, viewport: { x: 10, y: 20, zoom: 0.75 } };
  return {
    document: {
      id: 'payments-workshop',
      name: 'Payments discovery',
      snapshot,
      editions: [captureEdition({ id: 'discovery-1', name: 'First discussion', snapshot })],
      origin: {
        modelId: 'original-workshop',
        modelName: 'Original discovery',
        edition: captureEdition({ id: 'original-1', name: 'Original', snapshot }),
      },
    },
    sessionId: 'workshop-tab:1',
    revision: 7,
  };
}
test('default C4 preview leaves workshop intent unresolved without inventing structures, scope or communication', () => {
  const input = source(),
    before = JSON.stringify(input);
  const editor = createEditor(input.document.snapshot.graph),
    beforeEditor = JSON.stringify(editor);
  const preview = previewEventStormingC4Mapping(input);
  expect(preview.nodes.map((n) => [n.nodeId, n.type])).toEqual([
    ['lane', 'unmapped'],
    ['system', 'ambiguous'],
    ['command', 'unmapped'],
    ['event', 'unmapped'],
    ['hotspot', 'unmapped'],
    ['actor', 'ambiguous'],
  ]);
  expect(preview.nodes.find((n) => n.nodeId === 'actor')).toMatchObject({
    candidates: [
      { family: 'c4', role: 'person' },
      { family: 'c4', role: 'software-system' },
    ],
  });
  expect(preview.nodes.find((n) => n.nodeId === 'system')).toMatchObject({
    candidates: [
      { family: 'c4', role: 'software-system' },
      { family: 'c4', role: 'container' },
    ],
  });
  expect(preview.edges.map((e) => [e.edgeId, e.type])).toEqual([
    ['system-issues', 'unmapped'],
    ['system-handles', 'unmapped'],
    ['system-emits', 'unmapped'],
    ['command-produces', 'unmapped'],
    ['actor-issues', 'unmapped'],
  ]);
  expect(preview.disclosures).toEqual([]);
  expect(preview.choices).toEqual({ nodes: [], edges: [] });
  expect(Object.keys(preview).sort()).toEqual([
    'choices',
    'disclosures',
    'edges',
    'nodes',
    'provenance',
  ]);
  expect(JSON.stringify(input)).toBe(before);
  expect(JSON.stringify(editor)).toBe(beforeEditor);
});

const choices: ZlozEventStormingC4MappingOptions = {
  nodes: [
    {
      nodeId: 'system',
      architecture: { family: 'c4', role: 'software-system', scope: 'external' },
    },
    {
      nodeId: 'command',
      label: 'Payments API',
      architecture: { family: 'c4', role: 'container', technology: 'HTTP' },
    },
    { nodeId: 'event', architecture: null },
  ],
  edges: [
    { edgeId: 'system-handles', relationship: { label: 'Requests payment authorization' } },
    { edgeId: 'system-emits', relationship: null },
  ],
};
test('explicit structure and communication choices preserve identity, descriptions, world coordinates and direction in provenance', () => {
  const input = source(),
    before = serializeModelDocument(input.document);
  const preview = previewEventStormingC4Mapping(input, choices);
  expect(preview.nodes.find((n) => n.nodeId === 'command')).toMatchObject({
    type: 'proposed',
    origin: 'explicit',
    label: 'Payments API',
    architecture: { family: 'c4', role: 'container', technology: 'HTTP' },
  });
  expect(preview.nodes.find((n) => n.nodeId === 'system')).toMatchObject({
    type: 'proposed',
    architecture: { family: 'c4', role: 'software-system', scope: 'external' },
  });
  expect(preview.nodes.find((n) => n.nodeId === 'event')?.type).toBe('retained');
  expect(preview.edges.find((e) => e.edgeId === 'system-handles')).toMatchObject({
    type: 'proposed',
    origin: 'explicit',
    relationship: { label: 'Requests payment authorization' },
    sourceArchitecture: { family: 'event-storming', role: 'handles' },
  });
  expect(preview.edges.find((e) => e.edgeId === 'system-emits')?.type).toBe('retained');
  expect(
    preview.disclosures
      .filter((d) => d.kind === 'edge' && d.id === 'system-handles')
      .map((d) => d.code),
  ).toEqual(['relationship-meaning-replaced']);
  expect(preview.provenance).toEqual(input);
  expect(serializeModelDocument(preview.provenance.document)).toBe(before);
  expect(serializeModelDocument(input.document)).toBe(before);
});
test('proposals disclose lane interpretation, both hotspot statuses, membership, renaming and description replacement', () => {
  for (const status of ['open', 'resolved'] as const) {
    const original = source();
    const input = {
      ...original,
      document: {
        ...original.document,
        snapshot: {
          ...original.document.snapshot,
          graph: {
            ...original.document.snapshot.graph,
            nodes: original.document.snapshot.graph.nodes.map((n) =>
              n.architecture?.family === 'event-storming' && n.architecture.role === 'hotspot'
                ? { ...n, architecture: { ...n.architecture, status } }
                : n,
            ),
          },
        },
      },
    };
    const preview = previewEventStormingC4Mapping(input, {
      nodes: [
        { nodeId: 'lane', architecture: { family: 'c4', role: 'software-system' } },
        {
          nodeId: 'hotspot',
          label: 'Decision record service',
          architecture: {
            family: 'c4',
            role: 'component',
            description: 'Stores workshop decisions',
          },
        },
      ],
    });
    const lane = preview.nodes.find((n) => n.nodeId === 'lane');
    assert(lane?.type === 'proposed');
    expect(lane.architecture.description).toBe('Organize discovery; not a bounded context');
    expect(preview.disclosures.filter((d) => d.id === 'lane').map((d) => d.code)).toEqual([
      'workshop-meaning-replaced',
      'organizational-frame-reinterpreted',
      'membership-not-c4-containment',
    ]);
    expect(preview.disclosures.find((d) => d.code === 'hotspot-status-replaced')?.reason).toContain(
      `authored ${status} status`,
    );
    expect(preview.disclosures.filter((d) => d.id === 'hotspot').map((d) => d.code)).toEqual([
      'workshop-meaning-replaced',
      'hotspot-status-replaced',
      'membership-not-c4-containment',
      'label-replaced',
      'description-replaced',
    ]);
    expect(
      preview.provenance.document.snapshot.graph.nodes.find((n) => n.id === 'lane')?.kind,
    ).toBe('group');
    expect(
      preview.provenance.document.snapshot.graph.nodes.find((n) => n.id === 'hotspot')?.ports,
    ).toEqual([]);
  }
});
test('explicit relationships block unresolved or retained endpoints; compatible names never infer a mapping', () => {
  const relationships = { edges: [{ edgeId: 'system-handles', relationship: { label: 'Calls' } }] };
  const blocked = previewEventStormingC4Mapping(source(), relationships);
  expect(blocked.edges.find((e) => e.edgeId === 'system-handles')).toMatchObject({
    type: 'blocked',
    code: 'endpoint-not-c4',
  });
  expect(blocked.disclosures).toEqual([]);
  const retained = previewEventStormingC4Mapping(source(), {
    ...relationships,
    nodes: [
      { nodeId: 'command', architecture: { family: 'c4', role: 'container' } },
      { nodeId: 'system', architecture: null },
    ],
  });
  expect(retained.edges.find((e) => e.edgeId === 'system-handles')?.type).toBe('blocked');
  const noRelationship = previewEventStormingC4Mapping(source(), { nodes: choices.nodes });
  expect(noRelationship.edges.find((e) => e.edgeId === 'system-handles')?.type).toBe('unmapped');
});
test('mixed graphs inspect only incident relationships and accept authored C4 endpoints without reclassifying other nodes', () => {
  const original = source();
  const graph = original.document.snapshot.graph;
  const system = graph.nodes.find((n) => n.id === 'system');
  assert(system);
  const input = {
    ...original,
    document: {
      ...original.document,
      snapshot: {
        graph: {
          nodes: [
            ...graph.nodes,
            {
              ...system,
              id: 'existing-c4',
              architecture: { family: 'c4' as const, role: 'software-system' as const },
            },
            {
              ...system,
              id: 'existing-ddd',
              architecture: { family: 'ddd' as const, role: 'domain-service' as const },
            },
          ],
          edges: [
            ...graph.edges,
            {
              id: 'cross-c4',
              source: { node: 'system', port: 'out' },
              target: { node: 'existing-c4', port: 'in' },
              architecture: {
                family: 'ddd' as const,
                scope: 'tactical' as const,
                role: 'uses' as const,
              },
            },
            {
              id: 'cross-ddd',
              source: { node: 'system', port: 'out' },
              target: { node: 'existing-ddd', port: 'in' },
            },
            {
              id: 'outside',
              source: { node: 'existing-c4', port: 'out' },
              target: { node: 'existing-ddd', port: 'in' },
            },
          ],
        },
      },
    },
  };
  const preview = previewEventStormingC4Mapping(input, {
    nodes: [{ nodeId: 'system', architecture: { family: 'c4', role: 'container' } }],
    edges: [
      { edgeId: 'cross-c4', relationship: { label: 'Uses' } },
      { edgeId: 'cross-ddd', relationship: { label: 'Uses' } },
    ],
  });
  expect(preview.nodes.map((n) => n.nodeId)).toEqual([
    'lane',
    'system',
    'command',
    'event',
    'hotspot',
    'actor',
  ]);
  expect(preview.edges.find((e) => e.edgeId === 'cross-c4')).toMatchObject({
    type: 'proposed',
    sourceArchitecture: { family: 'ddd', scope: 'tactical', role: 'uses' },
  });
  expect(preview.disclosures).toContainEqual(
    expect.objectContaining({
      kind: 'edge',
      id: 'cross-c4',
      code: 'relationship-meaning-replaced',
    }),
  );
  expect(preview.edges.find((e) => e.edgeId === 'cross-ddd')).toMatchObject({
    type: 'blocked',
    code: 'endpoint-not-c4',
  });
  expect(preview.edges.some((e) => e.edgeId === 'outside')).toBe(false);
  expect(() =>
    previewEventStormingC4Mapping(input, {
      nodes: [{ nodeId: 'existing-c4', architecture: null }],
    }),
  ).toThrow('EventStorming');
  expect(() =>
    previewEventStormingC4Mapping(input, { edges: [{ edgeId: 'outside', relationship: null }] }),
  ).toThrow('incident');
});
test('full provenance and choices are detached and deeply frozen without freezing caller inputs', () => {
  const original = source();
  const mutableNode = {
    nodeId: 'system',
    architecture: {
      family: 'c4' as const,
      role: 'software-system' as const,
      description: 'A provider',
    },
  };
  const mutableEdge = { edgeId: 'system-handles', relationship: { label: 'Authorizes' } };
  const options = {
    nodes: [mutableNode, ...(choices.nodes ?? []).filter((n) => n.nodeId !== 'system')],
    edges: [mutableEdge],
  };
  const preview = previewEventStormingC4Mapping(original, options),
    captured = JSON.stringify(preview);
  mutableNode.architecture.description = 'Changed';
  mutableEdge.relationship.label = 'Changed';
  options.nodes.length = 0;
  expect(JSON.stringify(preview)).toBe(captured);
  expect(preview.provenance.document).not.toBe(original.document);
  expect(preview.provenance.document.snapshot.graph).not.toBe(original.document.snapshot.graph);
  expect(Object.isFrozen(original.document)).toBe(false);
  expect(Object.isFrozen(preview.provenance.document.origin?.edition.snapshot.graph.nodes)).toBe(
    true,
  );
  expect(Object.isFrozen(preview.choices.nodes[0]?.architecture)).toBe(true);
  expect(Object.isFrozen(preview.nodes)).toBe(true);
  expect(Object.isFrozen(preview.edges)).toBe(true);
  expect(Object.isFrozen(preview.disclosures)).toBe(true);
  expect(previewEventStormingC4Mapping(original, choices)).toEqual(
    previewEventStormingC4Mapping(original, choices),
  );
});
test('same graph in a different source/session/revision retains distinct review provenance and all prior editions', () => {
  const original = source(),
    preview = previewEventStormingC4Mapping(original, choices);
  for (const changed of [
    { ...original, sessionId: 'new-session' },
    { ...original, revision: 8 },
    { ...original, document: { ...original.document, id: 'forked-workshop' } },
  ]) {
    const next = previewEventStormingC4Mapping(changed, choices);
    expect(next.provenance).not.toEqual(preview.provenance);
    expect(next.nodes).toEqual(preview.nodes);
    expect(next.provenance.document.editions).toEqual(original.document.editions);
    expect(next.provenance.document.origin).toEqual(original.document.origin);
  }
});
test('invalid source scopes, malformed documents and incompatible kind choices reject before advisory output', () => {
  const input = source();
  for (const revision of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1])
    expect(() => previewEventStormingC4Mapping({ ...input, revision })).toThrow('revision');
  expect(() => previewEventStormingC4Mapping({ ...input, sessionId: ' ' })).toThrow('session');
  expect(() =>
    previewEventStormingC4Mapping({ ...input, document: { ...input.document, id: '' } }),
  ).toThrow();
  expect(() =>
    previewEventStormingC4Mapping(input, {
      nodes: [{ nodeId: 'lane', architecture: { family: 'c4', role: 'person' } }],
    }),
  ).toThrow('kind');
  expect(() =>
    previewEventStormingC4Mapping(input, {
      nodes: [{ nodeId: 'lane', architecture: { family: 'c4', role: 'component' } }],
    }),
  ).toThrow('kind');
  for (const role of ['software-system', 'container'] as const) {
    const preview = previewEventStormingC4Mapping(input, {
      nodes: [{ nodeId: 'lane', architecture: { family: 'c4', role } }],
    });
    expect(preview.nodes.find((n) => n.nodeId === 'lane')?.type).toBe('proposed');
  }
});
test('duplicate/missing choices, blank labels and unknown reserved fields never silently alter mappings', () => {
  const input = source();
  for (const options of [
    {
      nodes: [
        { nodeId: 'system', architecture: null },
        { nodeId: 'system', architecture: null },
      ],
    },
    { nodes: [{ nodeId: 'unknown', architecture: null }] },
    {
      edges: [
        { edgeId: 'system-handles', relationship: null },
        { edgeId: 'system-handles', relationship: null },
      ],
    },
    { edges: [{ edgeId: 'missing', relationship: null }] },
  ])
    expect(() => previewEventStormingC4Mapping(input, options)).toThrow('unique existing');
  expect(() =>
    previewEventStormingC4Mapping(input, {
      nodes: [{ nodeId: 'system', label: ' ', architecture: { family: 'c4', role: 'person' } }],
    }),
  ).toThrow('labels');
  expect(() =>
    previewEventStormingC4Mapping(input, {
      edges: [{ edgeId: 'system-handles', relationship: { label: '' } }],
    }),
  ).toThrow('label');
  // Literal wire-like values exercise runtime validation independently of the TypeScript contract.
  for (const json of [
    '{"nodes":[{"nodeId":"system","architecture":{"family":"c4","role":"person","technology":"HTTP"}}]}',
    '{"nodes":[{"nodeId":"system","architecture":{"family":"c4","role":"software-system","scope":"workshop"}}]}',
    '{"nodes":[{"nodeId":"system","architecture":{"family":"ddd","role":"entity"}}]}',
    '{"nodes":[{"nodeId":"system","architecture":null,"label":"Renamed"}]}',
    '{"nodes":[{"nodeId":"system","architecture":null,"apply":true}]}',
    '{"edges":[{"edgeId":"system-handles","relationship":{"label":"Calls","technology":"HTTP"}}]}',
    '{"edges":[{"edgeId":"system-handles","relationship":{"label":"Calls"},"reverse":true}]}',
    '{"nodes":{},"apply":true}',
    '{"nodes":[null]}',
    '{"edges":[null]}',
  ])
    expect(() => previewEventStormingC4Mapping(input, JSON.parse(json))).toThrow();
});
test('explicit retention is not omission or C4 compatibility and empty models remain deterministic', () => {
  const input = source();
  const preview = previewEventStormingC4Mapping(input, {
    nodes: input.document.snapshot.graph.nodes.map((n) => ({ nodeId: n.id, architecture: null })),
    edges: input.document.snapshot.graph.edges.map((e) => ({ edgeId: e.id, relationship: null })),
  });
  expect(preview.nodes.map((n) => n.type)).toEqual(Array(6).fill('retained'));
  expect(preview.edges.map((e) => e.type)).toEqual(Array(5).fill('retained'));
  expect(preview.disclosures).toEqual([]);
  expect(preview.provenance.document.snapshot.graph).toEqual(input.document.snapshot.graph);
  const empty = previewEventStormingC4Mapping({
    ...input,
    document: { ...input.document, snapshot: { graph: { nodes: [], edges: [] } } },
  });
  expect(empty.nodes).toEqual([]);
  expect(empty.edges).toEqual([]);
  expect(empty.disclosures).toEqual([]);
  expect(empty.provenance.document.editions).toEqual(input.document.editions);
});

test('later caller edits cannot rewrite the captured model, metadata or source scope', () => {
  const original = source();
  const nodes = original.document.snapshot.graph.nodes.map((node) => ({
    ...node,
    data: { owner: 'workshop' },
  }));
  const input = {
    ...original,
    document: {
      ...original.document,
      snapshot: {
        ...original.document.snapshot,
        graph: { ...original.document.snapshot.graph, nodes },
      },
    },
  };
  const preview = previewEventStormingC4Mapping(input, choices);
  const before = JSON.stringify(preview);
  const node = nodes[0];
  assert(node);
  node.label = 'Later name';
  node.data.owner = 'Changed owner';
  input.document.name = 'Later document';
  input.sessionId = 'Later session';
  input.revision = 99;
  expect(JSON.stringify(preview)).toBe(before);
  expect(preview.provenance.document.snapshot.graph.nodes[0]?.data).toEqual({ owner: 'workshop' });
});

test('naming a previously unlabelled communication is not reported as losing an authored label', () => {
  const input = source();
  const preview = previewEventStormingC4Mapping(input, choices);
  expect(
    preview.disclosures
      .filter((d) => d.kind === 'edge' && d.id === 'system-handles')
      .map((d) => d.code),
  ).toEqual(['relationship-meaning-replaced']);
  const labelled = {
    ...input,
    document: {
      ...input.document,
      snapshot: {
        ...input.document.snapshot,
        graph: {
          ...input.document.snapshot.graph,
          edges: input.document.snapshot.graph.edges.map((edge) =>
            edge.id === 'system-handles' ? { ...edge, label: 'Handles command' } : edge,
          ),
        },
      },
    },
  };
  expect(previewEventStormingC4Mapping(labelled, choices).disclosures).toContainEqual(
    expect.objectContaining({ kind: 'edge', id: 'system-handles', code: 'label-replaced' }),
  );
});
