import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  captureEdition,
  createEditor,
  createEventStormingC4ConversionPlan,
  resolveEventStormingC4ConversionConsent,
  parseGraph,
  serializeModelDocument,
  type ZlozEventStormingC4Source,
  type ZlozEventStormingC4ConversionOptions,
  type ZlozGraph,
  type ZlozNode,
} from '../src/index';
import wire from './fixtures/workshop-v1.json';
function source(): ZlozEventStormingC4Source {
  const graph = parseGraph(JSON.stringify(wire));
  const snapshot = { graph, viewport: { x: 30, y: 40, zoom: 0.8 } };
  const edition = captureEdition({ id: 'discovery', name: 'Discovery', snapshot });
  return {
    sessionId: 'c4-workshop:1',
    revision: 7,
    document: {
      id: 'payments',
      name: 'Payment workshop',
      snapshot,
      editions: [edition],
      origin: { modelId: 'original', modelName: 'Original workshop', edition },
    },
  };
}
function mappings(input = source()) {
  return {
    nodes: input.document.snapshot.graph.nodes
      .filter((node) => node.architecture?.family === 'event-storming')
      .map((node) =>
        node.id === 'system'
          ? {
              nodeId: node.id,
              architecture: { family: 'c4' as const, role: 'software-system' as const },
            }
          : { nodeId: node.id, architecture: null },
      ),
    edges: input.document.snapshot.graph.edges.map((edge) => ({
      edgeId: edge.id,
      relationship: null,
    })),
  };
}
test('a fully chosen mapping remains blocked until its membership is explicitly resolved; no partial changes escape', () => {
  const input = source();
  const plan = createEventStormingC4ConversionPlan(input, { mappings: mappings(input) });
  assert(plan.type === 'blocked');
  expect(plan.blockers).toContainEqual(
    expect.objectContaining({ kind: 'membership', id: 'system', code: 'choice-required' }),
  );
  expect('changes' in plan).toBe(false);
  expect(plan.provenance).toEqual(input);
});

const organization: ZlozEventStormingC4ConversionOptions = {
  mappings: mappings(),
  memberships: [{ nodeId: 'system', placement: { type: 'organization' } }],
};
function graphSource(graph: ZlozGraph, input = source()): ZlozEventStormingC4Source {
  return {
    ...input,
    document: { ...input.document, snapshot: { ...input.document.snapshot, graph } },
  };
}
function roots(input = source()): ZlozEventStormingC4ConversionOptions {
  return {
    mappings: mappings(input),
    memberships: [{ nodeId: 'system', placement: { type: 'root' } }],
  };
}
test('retained non-C4 organization is explicit, source-ordered and not a declaration of runtime containment', () => {
  const input = source(),
    before = serializeModelDocument(input.document);
  const editor = createEditor(input.document.snapshot.graph),
    editorBefore = JSON.stringify(editor);
  const plan = createEventStormingC4ConversionPlan(input, organization);
  assert(plan.type === 'reviewable');
  expect(plan.changes.nodes.map((n) => n.nodeId)).toEqual(['system']);
  expect(plan.changes.edges).toEqual([]);
  expect(plan.changes.memberships).toEqual([]);
  expect(plan.memberships).toEqual([
    {
      nodeId: 'system',
      before: { parentId: 'lane', extent: null, expandParent: null },
      type: 'resolved',
      placement: { type: 'organization' },
      after: { parentId: 'lane', extent: null, expandParent: null },
      reason:
        'Existing non-C4 grouping is explicitly retained as organization only, not C4 containment.',
    },
  ]);
  expect(plan.disclosures.map((d) => d.code)).toEqual(['workshop-meaning-replaced']);
  expect(plan.preview.disclosures.some((d) => d.code === 'membership-not-c4-containment')).toBe(
    true,
  );
  expect(serializeModelDocument(plan.provenance.document)).toBe(before);
  expect(serializeModelDocument(input.document)).toBe(before);
  expect(JSON.stringify(editor)).toBe(editorBefore);
  expect(Object.keys(plan).sort()).toEqual([
    'changes',
    'disclosures',
    'key',
    'mappings',
    'membershipChoices',
    'memberships',
    'preview',
    'provenance',
    'type',
  ]);
});
test('root detachment retains world geometry and original ports/data/settings in provenance and discloses removed constraints', () => {
  const original = source(),
    graph = original.document.snapshot.graph;
  const input = graphSource(
    {
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === 'system'
          ? {
              ...node,
              extent: 'parent',
              expandParent: false,
              data: { owner: 'workshop', nested: [1, 2] },
            }
          : node,
      ),
    },
    original,
  );
  const plan = createEventStormingC4ConversionPlan(input, roots(input));
  assert(plan.type === 'reviewable');
  expect(plan.changes.memberships).toHaveLength(1);
  expect(plan.changes.memberships[0]).toMatchObject({
    nodeId: 'system',
    before: { parentId: 'lane', extent: 'parent', expandParent: false },
    after: { parentId: null, extent: null, expandParent: null },
    placement: { type: 'root' },
  });
  expect(plan.disclosures.filter((d) => d.id === 'system').map((d) => d.code)).toEqual([
    'workshop-meaning-replaced',
    'membership-replaced',
    'parent-constraints-removed',
  ]);
  const before = graph.nodes.find((n) => n.id === 'system');
  const captured = plan.provenance.document.snapshot.graph.nodes.find((n) => n.id === 'system');
  expect(captured?.position).toEqual(before?.position);
  expect(captured?.size).toEqual(before?.size);
  expect(captured?.ports).toEqual(before?.ports);
  expect(captured?.data).toEqual({ owner: 'workshop', nested: [1, 2] });
  expect(captured?.extent).toBe('parent');
  expect(captured?.expandParent).toBe(false);
  expect(plan.provenance.document.snapshot.graph.edges).toEqual(graph.edges);
});
function boundaryOptions(input = source()): ZlozEventStormingC4ConversionOptions {
  const graph = input.document.snapshot.graph;
  return {
    mappings: {
      nodes: graph.nodes
        .filter((n) => n.architecture?.family === 'event-storming')
        .map((n) => {
          if (n.id === 'lane')
            return { nodeId: n.id, architecture: { family: 'c4', role: 'software-system' } };
          if (n.id === 'command')
            return {
              nodeId: n.id,
              architecture: { family: 'c4', role: 'container', technology: 'HTTP' },
              label: 'Payments API',
            };
          return { nodeId: n.id, architecture: null };
        }),
      edges: graph.edges.map((e) => ({ edgeId: e.id, relationship: null })),
    },
    memberships: graph.nodes
      .filter((n) => n.id === 'lane' || n.parentId === 'lane')
      .map((n) => ({
        nodeId: n.id,
        placement: n.id === 'command' ? { type: 'contained', parentId: 'lane' } : { type: 'root' },
      })),
  };
}
test('reinterpreting a lane requires placement of every direct member, including retained notes and existing non-workshop nodes', () => {
  const original = source(),
    graph = original.document.snapshot.graph;
  const extra: ZlozNode = {
    id: 'existing',
    label: 'Existing service',
    kind: 'group',
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    ports: [],
    parentId: 'lane',
    architecture: { family: 'c4', role: 'container' },
  };
  const input = graphSource({ ...graph, nodes: [...graph.nodes, extra] }, original);
  const options = boundaryOptions(input);
  const missing = createEventStormingC4ConversionPlan(input, {
    ...options,
    memberships: options.memberships?.filter((m) => m.nodeId === 'lane'),
  });
  assert(missing.type === 'blocked');
  expect(missing.blockers.filter((b) => b.kind === 'membership').map((b) => b.id)).toEqual([
    'system',
    'command',
    'event',
    'hotspot',
    'actor',
    'existing',
  ]);
  expect('changes' in missing).toBe(false);
  const plan = createEventStormingC4ConversionPlan(input, options);
  assert(plan.type === 'reviewable');
  expect(plan.memberships.map((m) => m.nodeId)).toEqual([
    'lane',
    'system',
    'command',
    'event',
    'hotspot',
    'actor',
    'existing',
  ]);
  expect(plan.changes.nodes.map((n) => n.nodeId)).toEqual(['lane', 'command']);
  expect(plan.changes.memberships.find((m) => m.nodeId === 'command')).toMatchObject({
    placement: { type: 'contained', parentId: 'lane' },
    before: { parentId: 'lane' },
    after: { parentId: 'lane' },
  });
  expect(plan.changes.memberships.some((m) => m.nodeId === 'lane')).toBe(false);
  expect(plan.disclosures.filter((d) => d.id === 'command').map((d) => d.code)).toEqual([
    'workshop-meaning-replaced',
    'label-replaced',
    'containment-declared',
  ]);
  expect(
    plan.disclosures.some((d) => d.id === 'existing' && d.code === 'membership-replaced'),
  ).toBe(true);
  expect(plan.memberships.find((m) => m.nodeId === 'hotspot')).toMatchObject({
    type: 'resolved',
    after: { parentId: null },
  });
});
test('retained notes cannot become implicit runtime children and a C4 boundary cannot be kept as organization', () => {
  const input = source(),
    options = boundaryOptions(input);
  for (const [placement, code] of [
    [{ type: 'organization' }, 'c4-parent-requires-containment'],
    [{ type: 'contained', parentId: 'lane' }, 'child-not-c4'],
  ] as const) {
    const plan = createEventStormingC4ConversionPlan(input, {
      ...options,
      memberships: options.memberships?.map((m) =>
        m.nodeId === 'hotspot' ? { ...m, placement } : m,
      ),
    });
    assert(plan.type === 'blocked');
    expect(plan.blockers).toContainEqual(
      expect.objectContaining({ kind: 'membership', id: 'hotspot', code }),
    );
    expect('changes' in plan).toBe(false);
  }
});
function containerSource() {
  const input = source(),
    graph = input.document.snapshot.graph;
  const container: ZlozNode = {
    id: 'container-frame',
    kind: 'group',
    label: 'Application',
    position: { x: 1000, y: 20 },
    size: { width: 500, height: 400 },
    ports: [],
    architecture: { family: 'c4', role: 'container', technology: 'Bun' },
  };
  const system: ZlozNode = {
    ...container,
    id: 'system-frame',
    label: 'Platform',
    architecture: { family: 'c4', role: 'software-system' },
  };
  return graphSource({ ...graph, nodes: [...graph.nodes, container, system] }, input);
}
test('explicit components can belong to authored container groups while kind/role/parent mismatches block', () => {
  const input = containerSource();
  const mapped = mappings(input);
  const components = {
    ...mapped,
    nodes: mapped.nodes.map((n) =>
      n.nodeId === 'system'
        ? { nodeId: n.nodeId, architecture: { family: 'c4' as const, role: 'component' as const } }
        : n,
    ),
  };
  const plan = createEventStormingC4ConversionPlan(input, {
    mappings: components,
    memberships: [
      { nodeId: 'system', placement: { type: 'contained', parentId: 'container-frame' } },
    ],
  });
  assert(plan.type === 'reviewable');
  expect(plan.changes.memberships[0]?.after.parentId).toBe('container-frame');
  expect(plan.disclosures.map((d) => d.code)).toEqual([
    'workshop-meaning-replaced',
    'membership-replaced',
    'containment-declared',
  ]);
  for (const [parentId, code] of [
    ['system-frame', 'incompatible-roles'],
    ['missing', 'parent-missing'],
    ['lane', 'parent-not-c4-boundary'],
    ['command', 'parent-not-c4-boundary'],
  ] as const) {
    const blocked = createEventStormingC4ConversionPlan(input, {
      mappings: components,
      memberships: [{ nodeId: 'system', placement: { type: 'contained', parentId } }],
    });
    assert(blocked.type === 'blocked');
    expect(blocked.blockers).toContainEqual(
      expect.objectContaining({ kind: 'membership', id: 'system', code }),
    );
  }
});
test('combined intended parent cycles are rejected instead of relying on individual placement checks', () => {
  const input = source(),
    options = boundaryOptions(input);
  const cycle = createEventStormingC4ConversionPlan(input, {
    ...options,
    memberships: options.memberships?.map((m) =>
      m.nodeId === 'lane' ? { ...m, placement: { type: 'contained', parentId: 'command' } } : m,
    ),
  });
  assert(cycle.type === 'blocked');
  expect(
    cycle.blockers.filter((b) => b.kind === 'membership' && b.code === 'cycle').map((b) => b.id),
  ).toEqual(['lane', 'command']);
  expect('changes' in cycle).toBe(false);
});
test('an unparented mapped node still requires root intent; organization cannot invent a parent', () => {
  const input = source(),
    graph = input.document.snapshot.graph;
  const root = graphSource(
    {
      ...graph,
      nodes: graph.nodes.map((node) => {
        if (node.id !== 'system') return node;
        const { parentId: _parentId, ...rest } = node;
        return rest;
      }),
    },
    input,
  );
  const absent = createEventStormingC4ConversionPlan(root, { mappings: mappings(root) });
  assert(absent.type === 'blocked');
  expect(absent.blockers).toContainEqual(
    expect.objectContaining({ kind: 'membership', id: 'system', code: 'choice-required' }),
  );
  const blocked = createEventStormingC4ConversionPlan(root, {
    ...organization,
    mappings: mappings(root),
  });
  assert(blocked.type === 'blocked');
  expect(blocked.blockers).toContainEqual(
    expect.objectContaining({ code: 'organization-parent-required' }),
  );
  const plan = createEventStormingC4ConversionPlan(root, roots(root));
  assert(plan.type === 'reviewable');
  expect(plan.changes.memberships).toEqual([]);
  expect(plan.memberships).toHaveLength(1);
});

test('consent is affirmative for the exact current source, placements and losses; null revokes it and no Apply event appears', () => {
  const input = source(),
    options = roots(input);
  const plan = createEventStormingC4ConversionPlan(input, options);
  assert(plan.type === 'reviewable');
  const consent = { planKey: plan.key, accepted: true as const };
  expect(resolveEventStormingC4ConversionConsent(input, options).type).toBe('consent-required');
  const accepted = resolveEventStormingC4ConversionConsent(input, options, consent);
  expect(accepted.type).toBe('consented');
  expect(Object.keys(accepted).sort()).toEqual(['plan', 'type']);
  expect(resolveEventStormingC4ConversionConsent(input, options, null).type).toBe(
    'consent-required',
  );
  expect(
    resolveEventStormingC4ConversionConsent(input, options, { ...consent, planKey: 'old-plan' })
      .type,
  ).toBe('consent-required');
  expect(resolveEventStormingC4ConversionConsent(input, organization, consent).type).toBe(
    'consent-required',
  );
  expect(
    resolveEventStormingC4ConversionConsent(input, { mappings: mappings(input) }, consent).type,
  ).toBe('blocked');
  const renamed = {
    ...options,
    mappings: {
      ...options.mappings,
      nodes: options.mappings?.nodes?.map((n) =>
        n.nodeId === 'system' && n.architecture !== null ? { ...n, label: 'Provider runtime' } : n,
      ),
    },
  };
  expect(resolveEventStormingC4ConversionConsent(input, renamed, consent).type).toBe(
    'consent-required',
  );
  // Runtime truthiness cannot stand in for the affirmative literal.
  expect(
    resolveEventStormingC4ConversionConsent(
      input,
      options,
      JSON.parse('{"accepted":"true","planKey":' + JSON.stringify(plan.key) + '}'),
    ).type,
  ).toBe('consent-required');
});
test('source scope, camera, authored data, editions and fork provenance all invalidate old plan consent', () => {
  const original = source(),
    options = roots(original);
  const plan = createEventStormingC4ConversionPlan(original, options);
  assert(plan.type === 'reviewable');
  const consent = { planKey: plan.key, accepted: true as const };
  const graph = original.document.snapshot.graph;
  for (const input of [
    { ...original, sessionId: 'another-session' },
    { ...original, revision: original.revision + 1 },
    { ...original, document: { ...original.document, id: 'another-model' } },
    { ...original, document: { ...original.document, name: 'Renamed model' } },
    {
      ...original,
      document: {
        ...original.document,
        snapshot: { ...original.document.snapshot, viewport: { x: 90, y: 80, zoom: 0.5 } },
      },
    },
    { ...original, document: { ...original.document, editions: [] } },
    { ...original, document: { ...original.document, origin: null } },
    graphSource(
      {
        ...graph,
        nodes: graph.nodes.map((n) => (n.id === 'system' ? { ...n, data: { changed: true } } : n)),
      },
      original,
    ),
  ])
    expect(resolveEventStormingC4ConversionConsent(input, options, consent).type).toBe(
      'consent-required',
    );
});
test('plans detach and freeze placements, complete source and mapping choices without freezing caller inputs', () => {
  const input = source();
  const memberships = [{ nodeId: 'system', placement: { type: 'root' as const } }];
  const options = { mappings: mappings(input), memberships };
  const plan = createEventStormingC4ConversionPlan(input, options),
    captured = JSON.stringify(plan);
  const first = memberships[0];
  assert(first);
  expect(Object.isFrozen(first.placement)).toBe(false);
  first.nodeId = 'later';
  Object.assign(first.placement, { type: 'organization' });
  options.mappings.nodes.length = 0;
  expect(JSON.stringify(plan)).toBe(captured);
  expect(Object.isFrozen(plan)).toBe(true);
  expect(Object.isFrozen(plan.membershipChoices[0]?.placement)).toBe(true);
  expect(Object.isFrozen(plan.memberships)).toBe(true);
  expect(Object.isFrozen(plan.disclosures)).toBe(true);
  expect(Object.isFrozen(plan.provenance.document.origin?.edition.snapshot.graph.nodes)).toBe(true);
  expect(Object.isFrozen(input.document)).toBe(false);
  expect(plan.provenance.document).not.toBe(input.document);
  expect(plan.provenance.document.snapshot.graph).not.toBe(input.document.snapshot.graph);
  expect(createEventStormingC4ConversionPlan(input, roots(input))).toEqual(
    createEventStormingC4ConversionPlan(input, roots(input)),
  );
});
test('invalid/duplicate/foreign placement syntax and invalid source scope reject without coercion', () => {
  const input = source(),
    options = roots(input);
  for (const json of [
    '{"memberships":[{"nodeId":"system","placement":{"type":"root"}},{"nodeId":"system","placement":{"type":"root"}}]}',
    '{"memberships":[{"nodeId":"missing","placement":{"type":"root"}}]}',
    '{"memberships":[{"nodeId":"actor","placement":{"type":"root"}}]}',
    '{"memberships":[{"nodeId":"system","placement":{"type":"root","parentId":"lane"}}]}',
    '{"memberships":[{"nodeId":"system","placement":{"type":"contained","parentId":" "}}]}',
    '{"memberships":[{"nodeId":"system","placement":{"type":"organization","force":true}}]}',
    '{"memberships":[{"nodeId":"system","placement":{"type":"automatic"}}]}',
    '{"memberships":[{"nodeId":"system","placement":null}]}',
    '{"memberships":[null]}',
    '{"memberships":{}}',
    '{"apply":true}',
  ])
    expect(() =>
      createEventStormingC4ConversionPlan(input, {
        ...JSON.parse(json),
        mappings: options.mappings,
      }),
    ).toThrow();
  expect(() => createEventStormingC4ConversionPlan({ ...input, sessionId: ' ' }, options)).toThrow(
    'session',
  );
  expect(() => createEventStormingC4ConversionPlan({ ...input, revision: -1 }, options)).toThrow(
    'revision',
  );
  expect(() =>
    createEventStormingC4ConversionPlan(input, {
      mappings: { nodes: [{ nodeId: 'lane', architecture: { family: 'c4', role: 'person' } }] },
    }),
  ).toThrow('kind');
});
test('every uncertain node and incident relationship must be explicitly mapped or retained before consent', () => {
  const input = source();
  const unresolved = createEventStormingC4ConversionPlan(input);
  assert(unresolved.type === 'blocked');
  expect(unresolved.blockers.filter((b) => b.kind === 'node').map((b) => b.id)).toEqual([
    'lane',
    'system',
    'command',
    'event',
    'hotspot',
    'actor',
  ]);
  expect(unresolved.blockers.filter((b) => b.kind === 'edge')).toHaveLength(5);
  expect('changes' in unresolved).toBe(false);
  const blockedEdge = createEventStormingC4ConversionPlan(input, {
    ...roots(input),
    mappings: {
      ...mappings(input),
      edges: [
        { edgeId: 'system-handles', relationship: { label: 'Calls' } },
        ...input.document.snapshot.graph.edges
          .filter((e) => e.id !== 'system-handles')
          .map((e) => ({ edgeId: e.id, relationship: null })),
      ],
    },
  });
  assert(blockedEdge.type === 'blocked');
  expect(blockedEdge.blockers).toContainEqual(
    expect.objectContaining({ kind: 'edge', id: 'system-handles', code: 'endpoint-not-c4' }),
  );
});
test('explicit communication proposals disclose reserved/label loss while preserving source endpoints, bends and host data', () => {
  const input = source();
  const options: ZlozEventStormingC4ConversionOptions = {
    mappings: {
      nodes: mappings(input).nodes.map((node) =>
        node.nodeId === 'command'
          ? {
              nodeId: node.nodeId,
              architecture: { family: 'c4', role: 'container' },
              label: 'Payments API',
            }
          : node,
      ),
      edges: input.document.snapshot.graph.edges.map((edge) => ({
        edgeId: edge.id,
        relationship: edge.id === 'system-handles' ? { label: 'Calls provider' } : null,
      })),
    },
    memberships: [
      { nodeId: 'system', placement: { type: 'root' } },
      { nodeId: 'command', placement: { type: 'organization' } },
    ],
  };
  const graph = input.document.snapshot.graph;
  const decorated = graphSource(
    {
      ...graph,
      edges: graph.edges.map((edge) =>
        edge.id === 'system-handles'
          ? {
              ...edge,
              label: 'Handles command',
              data: { owner: 'source' },
              waypoints: [{ id: 'bend', position: { x: 200, y: 40 } }],
            }
          : edge,
      ),
    },
    input,
  );
  const plan = createEventStormingC4ConversionPlan(decorated, options);
  assert(plan.type === 'reviewable');
  expect(plan.changes.edges.map((edge) => edge.edgeId)).toEqual(['system-handles']);
  expect(plan.changes.edges[0]?.relationship).toEqual({ label: 'Calls provider' });
  expect(plan.disclosures.filter((d) => d.kind === 'edge').map((d) => d.code)).toEqual([
    'relationship-meaning-replaced',
    'label-replaced',
  ]);
  const originalEdge = decorated.document.snapshot.graph.edges.find(
    (e) => e.id === 'system-handles',
  );
  expect(
    plan.provenance.document.snapshot.graph.edges.find((e) => e.id === 'system-handles'),
  ).toEqual(originalEdge);
});
test('all-retained and empty plans are unchanged without loss consent or invented memberships', () => {
  const input = source();
  const retained = {
    mappings: {
      nodes: input.document.snapshot.graph.nodes.map((n) => ({ nodeId: n.id, architecture: null })),
      edges: input.document.snapshot.graph.edges.map((e) => ({ edgeId: e.id, relationship: null })),
    },
  };
  const plan = createEventStormingC4ConversionPlan(input, retained);
  expect(plan.type).toBe('unchanged');
  expect(plan.memberships).toEqual([]);
  expect(plan.disclosures).toEqual([]);
  expect('changes' in plan).toBe(false);
  expect(
    resolveEventStormingC4ConversionConsent(input, retained, { planKey: plan.key, accepted: true })
      .type,
  ).toBe('unchanged');
  const empty = graphSource({ nodes: [], edges: [] }, input);
  expect(createEventStormingC4ConversionPlan(empty).type).toBe('unchanged');
  expect(createEventStormingC4ConversionPlan(empty).provenance.document.editions).toEqual(
    input.document.editions,
  );
});

test('both hotspot statuses survive in provenance and have explicit plan loss; changing status invalidates consent', () => {
  let priorKey: string | null = null;
  for (const status of ['open', 'resolved'] as const) {
    const original = source(),
      graph = original.document.snapshot.graph;
    const input = graphSource(
      {
        ...graph,
        nodes: graph.nodes.map((n) =>
          n.architecture?.family === 'event-storming' && n.architecture.role === 'hotspot'
            ? { ...n, architecture: { ...n.architecture, status } }
            : n,
        ),
      },
      original,
    );
    const options: ZlozEventStormingC4ConversionOptions = {
      mappings: {
        nodes: mappings(input).nodes.map((n) =>
          n.nodeId === 'hotspot'
            ? { nodeId: n.nodeId, architecture: { family: 'c4', role: 'component' } }
            : { nodeId: n.nodeId, architecture: null },
        ),
        edges: mappings(input).edges,
      },
      memberships: [{ nodeId: 'hotspot', placement: { type: 'organization' } }],
    };
    const plan = createEventStormingC4ConversionPlan(input, options);
    assert(plan.type === 'reviewable');
    expect(plan.disclosures.find((d) => d.code === 'hotspot-status-replaced')?.reason).toContain(
      `authored ${status} status`,
    );
    expect(
      plan.provenance.document.snapshot.graph.nodes.find((n) => n.id === 'hotspot')?.architecture,
    ).toMatchObject({ status });
    if (priorKey)
      expect(
        resolveEventStormingC4ConversionConsent(input, options, {
          planKey: priorKey,
          accepted: true,
        }).type,
      ).toBe('consent-required');
    priorKey = plan.key;
  }
});
test('an ordinary C4 card cannot be promoted to a parent group merely by declaring containment', () => {
  for (const [parentRole, childRole] of [
    ['software-system', 'container'],
    ['container', 'component'],
  ] as const) {
    const original = source(),
      graph = original.document.snapshot.graph;
    const card: ZlozNode = {
      id: 'card',
      label: 'Not a group',
      position: { x: 1000, y: 0 },
      size: { width: 500, height: 500 },
      ports: [],
      architecture: { family: 'c4', role: parentRole },
    };
    const input = graphSource({ ...graph, nodes: [...graph.nodes, card] }, original);
    const options: ZlozEventStormingC4ConversionOptions = {
      mappings: {
        ...mappings(input),
        nodes: mappings(input).nodes.map((n) =>
          n.nodeId === 'system'
            ? { nodeId: n.nodeId, architecture: { family: 'c4', role: childRole } }
            : n,
        ),
      },
      memberships: [{ nodeId: 'system', placement: { type: 'contained', parentId: 'card' } }],
    };
    const plan = createEventStormingC4ConversionPlan(input, options);
    assert(plan.type === 'blocked');
    expect(plan.blockers).toContainEqual(
      expect.objectContaining({ kind: 'membership', id: 'system', code: 'parent-not-c4-boundary' }),
    );
    expect('changes' in plan).toBe(false);
  }
});

test('nested lane interpretations qualify a complete system/container/component hierarchy in source order', () => {
  const original = source(),
    graph = original.document.snapshot.graph;
  const inner: ZlozNode = {
    id: 'inner',
    kind: 'group',
    label: 'Application frame',
    position: { x: 0, y: 0 },
    size: { width: 500, height: 300 },
    ports: [],
    parentId: 'lane',
    architecture: { family: 'event-storming', role: 'lane' },
  };
  const input = graphSource(
    {
      ...graph,
      nodes: [
        ...graph.nodes.map((node) =>
          node.id === 'command' ? { ...node, parentId: 'inner' } : node,
        ),
        inner,
      ],
    },
    original,
  );
  const options: ZlozEventStormingC4ConversionOptions = {
    mappings: {
      nodes: input.document.snapshot.graph.nodes.map((node) => {
        if (node.id === 'lane')
          return { nodeId: node.id, architecture: { family: 'c4', role: 'software-system' } };
        if (node.id === 'inner')
          return {
            nodeId: node.id,
            architecture: { family: 'c4', role: 'container', technology: 'Bun' },
          };
        if (node.id === 'command')
          return {
            nodeId: node.id,
            architecture: { family: 'c4', role: 'component' },
            label: 'Payment handler',
          };
        return { nodeId: node.id, architecture: null };
      }),
      edges: mappings(input).edges,
    },
    memberships: input.document.snapshot.graph.nodes.map((node) => ({
      nodeId: node.id,
      placement:
        node.id === 'command'
          ? { type: 'contained', parentId: 'inner' }
          : node.id === 'inner'
            ? { type: 'contained', parentId: 'lane' }
            : { type: 'root' },
    })),
  };
  const plan = createEventStormingC4ConversionPlan(input, options);
  assert(plan.type === 'reviewable');
  expect(plan.changes.nodes.map((n) => n.nodeId)).toEqual(['lane', 'command', 'inner']);
  expect(
    plan.memberships.flatMap((m) =>
      m.type === 'resolved' && m.placement.type === 'contained'
        ? [[m.nodeId, m.after.parentId]]
        : [],
    ),
  ).toEqual([
    ['command', 'inner'],
    ['inner', 'lane'],
  ]);
  expect(
    plan.disclosures.filter((d) => d.code === 'containment-declared').map((d) => d.id),
  ).toEqual(['command', 'inner']);
  expect(plan.provenance.document.snapshot.graph.nodes.map((n) => n.position)).toEqual(
    input.document.snapshot.graph.nodes.map((n) => n.position),
  );
});
