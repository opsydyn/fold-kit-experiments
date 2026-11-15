import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  parseGraph,
  serializeGraph,
  parseSnapshot,
  serializeSnapshot,
  captureEdition,
  compareEditions,
  serializeEditions,
  parseEditions,
  captureModelDocument,
  serializeModelDocument,
  parseModelDocument,
  createEditor,
  updateEditor,
  createArchitectureNode,
  isNodeArchitecture,
  resolveEventStormingNodeSemantics,
  eventStormingParticipantRole,
  auditEventStormingRelationships,
  eventStormingWorkshopRelationshipRules,
  resolveEventStormingRelationship,
  eventStormingRelationshipPolicy,
  previewEventStormingDddMapping,
  createEventStormingDddConversionPlan,
  applyEventStormingDddConversion,
  serializeEventStormingDddConversion,
  parseEventStormingDddConversion,
  planSvgExport,
  writeSvgExport,
  type ZlozSvgExportOptions,
} from '../src/index';
import wire from './fixtures/workshop-v1.json';
const fixture = () => parseGraph(JSON.stringify(wire));
test('literal workshop descriptors distinguish participants, annotations and organizational frames and preserve every codec', () => {
  const graph = fixture();
  expect(graph.nodes.map((n) => [n.id, resolveEventStormingNodeSemantics(n)])).toEqual([
    ['lane', { kind: 'frame', role: 'lane' }],
    ['system', { kind: 'participant', role: 'external-system' }],
    ['command', { kind: 'participant', role: 'command' }],
    ['event', { kind: 'participant', role: 'domain-event' }],
    ['hotspot', { kind: 'annotation', role: 'hotspot', status: 'open' }],
    ['actor', { kind: 'participant', role: 'actor' }],
  ]);
  expect(parseGraph(serializeGraph(graph))).toEqual(graph);
  const snapshot = { graph, viewport: { x: 30, y: 40, zoom: 0.8 } };
  expect(parseSnapshot(serializeSnapshot(snapshot))).toEqual(snapshot);
  const edition = captureEdition({ id: 'workshop', name: 'Discovery', snapshot });
  expect(parseEditions(serializeEditions([edition]))).toEqual([edition]);
  const model = captureModelDocument({
    id: 'payments',
    name: 'Payments',
    snapshot,
    editions: [edition],
    origin: null,
  });
  expect(parseModelDocument(serializeModelDocument(model))).toEqual(model);
  for (const n of graph.nodes) {
    const { parentId: _parent, ...input } = n;
    const architecture = input.architecture;
    assert(architecture);
    expect(createArchitectureNode({ ...input, architecture }).architecture).toEqual(architecture);
  }
});
test('strict workshop descriptors reject incompatible kind/ports, missing status and role-specific unknown fields', () => {
  for (const architecture of [
    { family: 'event-storming', role: 'hotspot' },
    { family: 'event-storming', role: 'hotspot', status: 'closed' },
    { family: 'event-storming', role: 'hotspot', status: null },
    { family: 'event-storming', role: 'hotspot', status: 'open', owner: 'me' },
    { family: 'event-storming', role: 'lane', status: 'open' },
    { family: 'event-storming', role: 'external-system', status: 'resolved' },
    { family: 'event-storming', role: 'external-system', technology: 'Cloud' },
    { family: 'ddd', role: 'lane' },
  ])
    expect(isNodeArchitecture(architecture)).toBe(false);
  const changes = [
    { id: 'lane', kind: undefined },
    { id: 'lane', ports: wire.graph.nodes[1]?.ports },
    { id: 'hotspot', kind: 'group' },
    { id: 'hotspot', ports: wire.graph.nodes[1]?.ports },
    { id: 'system', kind: 'group' },
  ];
  for (const change of changes)
    expect(() =>
      parseGraph(
        JSON.stringify({
          ...wire,
          graph: {
            ...wire.graph,
            nodes: wire.graph.nodes.map((n) => (n.id === change.id ? { ...n, ...change } : n)),
          },
        }),
      ),
    ).toThrow();
  expect(() =>
    parseGraph(
      JSON.stringify({
        ...wire,
        graph: {
          ...wire.graph,
          edges: [
            {
              id: 'annotation-edge',
              source: { node: 'hotspot', port: 'out' },
              target: { node: 'command', port: 'in' },
            },
          ],
        },
      }),
    ),
  ).toThrow();
});
test('external systems use explicit issues/handles/emits conventions while annotations and lanes never become causal participants', () => {
  const graph = fixture(),
    system = graph.nodes.find((n) => n.id === 'system');
  assert(system);
  expect(eventStormingParticipantRole(system)).toBe('external-system');
  const options = { rules: eventStormingWorkshopRelationshipRules };
  const audit = auditEventStormingRelationships(graph, options);
  expect(auditEventStormingRelationships(graph).summary.blocked).toBe(3);
  expect(audit.summary).toEqual({ edges: 5, typed: 5, inferred: 0, unrelated: 0, blocked: 0 });
  const edge = graph.edges.find((e) => e.id === 'system-issues');
  assert(edge);
  const { architecture: _a, ...untyped } = edge;
  expect(resolveEventStormingRelationship(graph, untyped, options)).toMatchObject({
    type: 'allowed',
    inferred: true,
    architecture: { role: 'issues' },
  });
  for (const id of ['hotspot', 'lane']) {
    const n = graph.nodes.find((n) => n.id === id);
    assert(n);
    expect(eventStormingParticipantRole(n)).toBeNull();
    expect(
      resolveEventStormingRelationship(
        graph,
        { ...edge, source: { node: id, port: 'out' } },
        { roleOf: () => 'command' },
      ),
    ).toMatchObject({ type: 'blocked', code: 'unsupported-role' });
  }
  const editor = createEditor(graph);
  const protectedEdit = updateEditor(
    editor,
    {
      type: 'NodeArchitectureChanged',
      id: 'system',
      architecture: { family: 'event-storming', role: 'actor' },
    },
    eventStormingRelationshipPolicy(options),
  );
  expect(protectedEdit.graph).toBe(editor.graph);
  expect(protectedEdit.notice).toContain('does not allow');
});
test('hotspot status and lane semantics compose existing live policies, duplication, deletion, movement and one-step Undo', () => {
  const graph = fixture(),
    editor = createEditor(graph);
  const event = {
    type: 'NodeArchitectureChanged',
    id: 'hotspot',
    architecture: {
      family: 'event-storming',
      role: 'hotspot',
      status: 'resolved',
      description: 'Clarify retry ownership',
    },
  } as const;
  const changed = updateEditor(editor, event);
  expect(changed.past).toHaveLength(1);
  const diff = compareEditions(
    captureEdition({ id: 'before', name: 'Before', snapshot: { graph } }),
    captureEdition({ id: 'after', name: 'After', snapshot: { graph: changed.graph } }),
  );
  expect(
    diff.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      semantic: n.semanticChanged,
      layout: n.layoutChanged,
    })),
  ).toEqual([{ id: 'hotspot', kind: 'changed', semantic: true, layout: false }]);
  expect(changed.graph.nodes.find((n) => n.id === 'hotspot')?.architecture).toMatchObject({
    role: 'hotspot',
    status: 'resolved',
  });
  expect(updateEditor(changed, { type: 'UndoPressed' }).graph).toEqual(graph);
  expect(updateEditor(changed, event)).toBe(changed);
  const blocked = updateEditor(editor, event, { canChangeNodeArchitecture: () => 'Review locked' });
  expect(blocked.graph).toBe(editor.graph);
  expect(blocked.notice).toBe('Review locked');
  expect(blocked.past).toHaveLength(0);
  const selected = { ...editor, selectedNodes: ['lane'] };
  const moved = updateEditor(selected, { type: 'SelectionNudged', delta: { x: 10, y: 20 } });
  expect(moved.graph.nodes.map((n) => n.position)).toEqual(
    graph.nodes.map((n) => ({ x: n.position.x + 10, y: n.position.y + 20 })),
  );
  expect(updateEditor(moved, { type: 'UndoPressed' }).graph).toEqual(graph);
  const duplicated = updateEditor(selected, { type: 'DuplicatePressed' });
  expect(duplicated.graph.nodes).toHaveLength(12);
  const copy = duplicated.graph.nodes.find(
    (n) =>
      n.id !== 'lane' &&
      n.architecture?.family === 'event-storming' &&
      n.architecture.role === 'lane',
  );
  assert(copy);
  expect(duplicated.graph.nodes.filter((n) => n.parentId === copy.id)).toHaveLength(5);
  expect(
    duplicated.graph.nodes
      .filter(
        (n) => n.architecture?.family === 'event-storming' && n.architecture.role === 'hotspot',
      )
      .map((n) => n.architecture),
  ).toEqual([graph.nodes[4]?.architecture, graph.nodes[4]?.architecture]);
  expect(updateEditor(duplicated, { type: 'UndoPressed' }).graph).toEqual(graph);
  const pasted = updateEditor(updateEditor(selected, { type: 'CopyPressed' }), {
    type: 'PastePressed',
  });
  expect(pasted.graph.nodes).toHaveLength(12);
  expect(pasted.graph.edges).toHaveLength(10);
  const ungrouped = updateEditor(selected, { type: 'SelectionUngrouped' });
  expect(ungrouped.graph.nodes).toHaveLength(5);
  expect(ungrouped.graph.nodes.every((n) => n.parentId === undefined)).toBe(true);
  expect(ungrouped.graph.nodes.map((n) => n.position)).toEqual(
    graph.nodes.filter((n) => n.id !== 'lane').map((n) => n.position),
  );
  expect(ungrouped.graph.edges).toEqual(graph.edges);
  expect(updateEditor(ungrouped, { type: 'UndoPressed' }).graph).toEqual(graph);
  const deleted = updateEditor(selected, { type: 'DeletePressed' });
  expect(deleted.graph).toEqual({ nodes: [], edges: [] });
  expect(updateEditor(deleted, { type: 'UndoPressed' }).graph).toEqual(graph);
});
test('DDD preview never infers systems/contexts or annotation meaning; explicit status replacement requires exact consent and retains provenance', () => {
  const graph = fixture(),
    preview = previewEventStormingDddMapping(graph);
  for (const id of ['system', 'lane', 'hotspot'])
    expect(preview.nodes.find((n) => n.nodeId === id)).toMatchObject({ type: 'unmapped' });
  expect(preview.nodes.find((n) => n.nodeId === 'hotspot')?.reason).toContain('annotation');
  const editor = createEditor(graph),
    source = {
      sessionId: 'workshop-session',
      revision: editor.revision,
      document: {
        id: 'payments',
        name: 'Payments',
        snapshot: { graph, viewport: editor.viewport },
        editions: [],
        origin: null,
      },
    };
  const mappings = {
    nodes: graph.nodes.map((n) => ({
      nodeId: n.id,
      architecture:
        n.id === 'hotspot' ? { family: 'ddd' as const, role: 'value-object' as const } : null,
    })),
    edges: graph.edges.map((e) => ({ edgeId: e.id, architecture: null })),
  };
  const plan = createEventStormingDddConversionPlan(source, mappings);
  assert(plan.type === 'reviewable');
  expect(
    plan.provenance.document.snapshot.graph.nodes.find((n) => n.id === 'hotspot')?.architecture,
  ).toMatchObject({ role: 'hotspot', status: 'open' });
  expect(plan.preview.disclosures.some((loss) => loss.reason.includes('open'))).toBe(true);
  const denied = applyEventStormingDddConversion(editor, source, {
    mappings,
    consent: null,
  });
  expect(denied.type).toBe('blocked');
  const result = applyEventStormingDddConversion(editor, source, {
    mappings,
    consent: { planKey: plan.key, accepted: true },
  });
  assert(result.type === 'applied');
  expect(result.editor.past).toHaveLength(1);
  const receipt = parseEventStormingDddConversion(
    serializeEventStormingDddConversion(result.conversion),
  );
  expect(receipt).toEqual(result.conversion);
  expect(updateEditor(result.editor, { type: 'UndoPressed' }).graph).toEqual(graph);
});
const svgOptions: ZlozSvgExportOptions = {
  title: 'Workshop',
  region: { type: 'model', padding: 12 },
  theme: { colorScheme: 'light' },
  background: { type: 'theme' },
  font: { family: 'Inter', size: 14, weight: 400 },
  renderers: { nodes: 'built-in', edges: 'built-in' },
};
test('qualified workshop artwork is reviewable; custom shell fallback still requires host loss declaration', () => {
  const editor = createEditor(fixture()),
    plan = planSvgExport(editor, svgOptions);
  expect(plan.type).toBe('reviewable');
  expect(plan.findings.filter((f) => f.code === 'renderer-unsupported')).toEqual([]);
  const overrides = ['lane', 'system', 'hotspot'].map((id) => ({
    target: { kind: 'node' as const, id },
    renderer: {
      type: 'fallback' as const,
      reason: 'Custom workshop shell becomes canonical static artwork',
    },
  }));
  const fallback = planSvgExport(editor, {
    ...svgOptions,
    renderers: { ...svgOptions.renderers, overrides },
  });
  expect(fallback.type).toBe('reviewable');
  expect(fallback.findings.filter((f) => f.code === 'renderer-fallback')).toHaveLength(3);
  const written = writeSvgExport(
    editor,
    { ...svgOptions, renderers: { ...svgOptions.renderers, overrides } },
    { allowLosses: true },
  );
  assert(written.type === 'written');
  expect(written.svg).not.toContain('undefined');
});
