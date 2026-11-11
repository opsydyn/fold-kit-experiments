import { expect, test } from 'bun:test';

import {
  applyEventStormingDddConversion,
  createArchitectureNode,
  createEditor,
  createEventStormingDddConversionPlan,
  captureEdition,
  captureModelDocument,
  serializeModelDocument,
  parseModelDocument,
  serializeEventStormingDddConversion,
  parseEventStormingDddConversion,
  updateEditor,
  type EditorState,
  type ZlozModelDocument,
  type ZlozEventStormingDddConversionSource,
} from '../src/index';
function fixture(options: { historyLimit?: number } = {}) {
  const node = (id: string, role: 'aggregate-root' | 'domain-event') =>
    createArchitectureNode({
      id,
      label: id,
      position: { x: id === 'root' ? 20 : 320, y: id === 'b' ? 180 : 20 },
      size: { width: 200, height: 120 },
      ports: [
        { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
        { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
      ],
      architecture:
        role === 'aggregate-root'
          ? { family: 'ddd', role }
          : { family: 'event-storming', role, description: `Workshop ${id}` },
      data: { owner: 'domain team', nested: { keep: true } },
    });
  const graph = {
    nodes: [node('root', 'aggregate-root'), node('a', 'domain-event'), node('b', 'domain-event')],
    edges: ['a', 'b'].map((id) => ({
      id: `emits-${id}`,
      label: `Emits ${id}`,
      source: { node: 'root', port: 'out' },
      target: { node: id, port: 'in' },
      architecture: {
        family: 'event-storming' as const,
        role: 'emits' as const,
        description: 'Discovered emission',
      },
      data: { host: id },
      pathStyle: 'straight' as const,
    })),
  };
  const base = createEditor(graph, { ...options, viewport: { x: 30, y: 40, zoom: 1.2 } });
  const editor = updateEditor(
    updateEditor(base, { type: 'NodeLabelChanged', id: 'root', label: 'Temporary branch' }),
    { type: 'UndoPressed' },
  );
  const edition = captureEdition({ id: 'workshop', name: 'Discovery', snapshot: { graph } });
  const document: ZlozModelDocument = {
    id: 'orders',
    name: 'Orders',
    snapshot: { graph: editor.graph, viewport: editor.viewport },
    editions: [edition],
    origin: { modelId: 'discovery-model', modelName: 'Discovery model', edition },
  };
  const source: ZlozEventStormingDddConversionSource = {
    document,
    sessionId: 'orders:tab:1',
    revision: editor.revision,
  };
  const plan = createEventStormingDddConversionPlan(source);
  return { editor, source, options: { consent: { planKey: plan.key, accepted: true as const } } };
}
function withEditor(source: ZlozEventStormingDddConversionSource, editor: EditorState) {
  return {
    ...source,
    revision: editor.revision,
    document: { ...source.document, snapshot: { graph: editor.graph, viewport: editor.viewport } },
  };
}

test('atomic Apply retains complete source and reviewed mappings, commits all descriptors once and supports Undo/Redo', () => {
  const { editor, source, options } = fixture(),
    before = serializeModelDocument(source.document);
  const selected = { ...editor, selectedNodes: ['a'], selectedEdges: ['emits-b'] };
  const result = applyEventStormingDddConversion(selected, source, options);
  expect(result.type).toBe('applied');
  if (result.type !== 'applied') throw new Error('Expected applied fixture');
  expect(result.editor.revision).toBe(editor.revision + 1);
  expect(result.editor.past).toEqual([editor.graph]);
  expect(result.editor.future).toEqual([]);
  expect(result.editor.graph.nodes.map((n) => n.architecture?.family)).toEqual([
    'ddd',
    'ddd',
    'ddd',
  ]);
  expect(result.editor.graph.edges.map((e) => e.architecture)).toEqual(
    ['a', 'b'].map(() => ({
      family: 'ddd',
      scope: 'tactical',
      role: 'emits',
      description: 'Discovered emission',
    })),
  );
  expect(result.editor.viewport).toEqual(editor.viewport);
  expect(result.editor.selectedNodes).toEqual(['a']);
  expect(result.editor.selectedEdges).toEqual(['emits-b']);
  expect(result.conversion.source).toEqual(source);
  expect(result.conversion.document.snapshot.graph).toEqual(result.editor.graph);
  expect(result.conversion.document.id).toBe(source.document.id);
  expect(result.conversion.document.editions).toEqual(source.document.editions);
  expect(result.conversion.document.origin).toEqual(source.document.origin);
  expect(result.conversion.lossesAccepted).toBe(true);
  expect(Object.isFrozen(result.conversion.source.document.snapshot.graph)).toBe(true);
  expect(serializeModelDocument(source.document)).toBe(before);
  for (const [index, node] of result.editor.graph.nodes.entries()) {
    const original = editor.graph.nodes[index];
    if (!original) throw new Error('Missing source node');
    expect(node.id).toBe(original.id);
    expect(node.ports).toEqual(original.ports);
    expect(node.data).toEqual(original.data);
    expect(node.position).toEqual(original.position);
    expect(node.size).toEqual(original.size);
    expect(node.appearance).toEqual(original.appearance);
  }
  for (const [index, edge] of result.editor.graph.edges.entries()) {
    const original = editor.graph.edges[index];
    if (!original) throw new Error('Missing source edge');
    expect(edge.id).toBe(original.id);
    expect(edge.source).toEqual(original.source);
    expect(edge.target).toEqual(original.target);
    expect(edge.label).toBe(original.label);
    expect(edge.data).toEqual(original.data);
    expect(edge.pathStyle).toBe(original.pathStyle);
  }
  expect(updateEditor(result.editor, { type: 'UndoPressed' }).graph).toEqual(editor.graph);
  const undone = updateEditor(result.editor, { type: 'UndoPressed' });
  expect(updateEditor(undone, { type: 'RedoPressed' }).graph).toEqual(result.editor.graph);
});

test('late node/edge and whole-transaction vetoes leave editor, Undo and source untouched', () => {
  const { editor, source, options } = fixture();
  for (const policy of [
    {
      canChangeNodeArchitecture: (node: { id: string }) =>
        node.id === 'b' ? 'Second node is managed' : null,
    },
    {
      canChangeEdgeArchitecture: (edge: { id: string }) =>
        edge.id === 'emits-b' ? 'Second edge is managed' : null,
    },
    { canApplyEventStormingDddConversion: () => 'Conversion protected' },
    { canChangeEdgeArchitecture: () => '   ' },
  ]) {
    const result = applyEventStormingDddConversion(editor, source, { ...options, policy });
    expect(result.type).toBe('blocked');
    expect(result.editor).toBe(editor);
    expect(editor.past).toEqual([]);
    expect(editor.future).toHaveLength(1);
    expect('conversion' in result).toBe(false);
  }
});

test('bulk policy sees complete final semantics; granular hooks keep their current-graph contract on frozen copies', () => {
  const { editor, source, options } = fixture();
  const seen: string[] = [];
  const result = applyEventStormingDddConversion(editor, source, {
    ...options,
    policy: {
      canApplyEventStormingDddConversion: (plan, after) => {
        expect(plan.provenance.document).toEqual(source.document);
        expect(after.snapshot.graph.nodes.every((n) => n.architecture?.family === 'ddd')).toBe(
          true,
        );
        expect(after.snapshot.graph.edges.every((e) => e.architecture?.family === 'ddd')).toBe(
          true,
        );
        return null;
      },
      canChangeNodeArchitecture: (node, next, graph) => {
        expect(graph).toEqual(editor.graph);
        expect(graph).not.toBe(editor.graph);
        expect(Object.isFrozen(node)).toBe(true);
        expect(node.architecture?.family).toBe('event-storming');
        expect(next.architecture?.family).toBe('ddd');
        seen.push(node.id);
        return null;
      },
      canChangeEdgeArchitecture: (edge, next, graph) => {
        expect(graph).toEqual(editor.graph);
        expect(Object.isFrozen(next)).toBe(true);
        expect(next.architecture?.family).toBe('ddd');
        seen.push(edge.id);
        return null;
      },
    },
  });
  expect(result.type).toBe('applied');
  expect(seen).toEqual(['a', 'b', 'emits-a', 'emits-b']);
});

test('read-only, gestures, pending connections, label drafts, external busy state and disabled Undo block Apply', () => {
  const { editor, source, options } = fixture();
  const states: readonly EditorState[] = [
    { ...editor, readOnly: true },
    { ...editor, connection: { node: 'root', port: 'out' } },
    { ...editor, edgeLabelDraft: { id: 'emits-a', text: 'Draft' } },
    { ...editor, historyLimit: 0 },
    {
      ...editor,
      fitViewTransition: {
        type: 'fitting',
        id: 1,
        from: editor.viewport,
        to: editor.viewport,
        startedAt: null,
      },
    },
    updateEditor(editor, {
      type: 'NodeDragStarted',
      id: 'a',
      pointer: 1,
      point: { x: 10, y: 20 },
    }),
  ];
  for (const state of states) {
    const result = applyEventStormingDddConversion(state, withEditor(source, state), options);
    expect(result.type).toBe('blocked');
    expect(result.editor).toBe(state);
  }
  expect(
    applyEventStormingDddConversion(editor, source, {
      ...options,
      blockedReason: 'Import in progress',
    }),
  ).toMatchObject({ type: 'blocked', reason: 'Import in progress' });
});

test('freshness compares editor revision, exact live graph/camera, source identity, session and metadata with reviewed consent', () => {
  const { editor, source, options } = fixture();
  const variants: readonly ZlozEventStormingDddConversionSource[] = [
    { ...source, revision: source.revision - 1 },
    { ...source, sessionId: 'new-session' },
    { ...source, document: { ...source.document, id: 'different-model' } },
    { ...source, document: { ...source.document, editions: [] } },
    { ...source, document: { ...source.document, snapshot: { graph: editor.graph } } },
    {
      ...source,
      document: {
        ...source.document,
        snapshot: { ...source.document.snapshot, viewport: { x: 0, y: 0, zoom: 1 } },
      },
    },
  ];
  for (const changed of variants) {
    const result = applyEventStormingDddConversion(editor, changed, options);
    expect(result.type).toBe('blocked');
    expect(result.editor).toBe(editor);
  }
  const moved = updateEditor(editor, {
    type: 'ViewportChanged',
    viewport: { ...editor.viewport, x: 99 },
  });
  expect(applyEventStormingDddConversion(moved, source, options).type).toBe('blocked');
  expect(applyEventStormingDddConversion(moved, withEditor(source, moved), options).type).toBe(
    'blocked',
  );
  const renamed = updateEditor(editor, {
    type: 'NodeLabelChanged',
    id: 'a',
    label: 'Changed source',
  });
  expect(applyEventStormingDddConversion(renamed, source, options).type).toBe('blocked');
  expect(applyEventStormingDddConversion(renamed, withEditor(source, renamed), options).type).toBe(
    'blocked',
  );
});

test('absent or changed consent and unresolved intent never publish a partial conversion', () => {
  const { editor, source, options } = fixture();
  expect(applyEventStormingDddConversion(editor, source, { consent: null })).toMatchObject({
    type: 'blocked',
    code: 'consent-required',
  });
  const different = {
    nodes: [
      {
        nodeId: 'a',
        architecture: { family: 'ddd', role: 'domain-event', description: 'Refined' },
      },
    ],
  } as const;
  expect(
    applyEventStormingDddConversion(editor, source, { ...options, mappings: different }).type,
  ).toBe('blocked');
  const input = {
    ...source,
    document: {
      ...source.document,
      snapshot: {
        ...source.document.snapshot,
        graph: {
          ...editor.graph,
          nodes: editor.graph.nodes.map((n) =>
            n.id === 'a'
              ? {
                  ...n,
                  architecture: { family: 'event-storming' as const, role: 'command' as const },
                }
              : n,
          ),
        },
      },
    },
  };
  const unresolvedEditor = createEditor(input.document.snapshot.graph, {
    viewport: editor.viewport,
  });
  const unresolvedSource = { ...input, revision: unresolvedEditor.revision };
  const plan = createEventStormingDddConversionPlan(unresolvedSource);
  const result = applyEventStormingDddConversion(unresolvedEditor, unresolvedSource, {
    consent: { planKey: plan.key, accepted: true },
  });
  expect(result).toMatchObject({ type: 'blocked', code: 'unresolved-mapping' });
  expect(result.editor).toBe(unresolvedEditor);
});

test('all-retained no-op needs no Undo and produces no receipt; old Apply cannot replay after success or Undo', () => {
  const { editor, source, options } = fixture();
  const mappings = {
    nodes: ['a', 'b'].map((nodeId) => ({ nodeId, architecture: null })),
    edges: ['emits-a', 'emits-b'].map((edgeId) => ({ edgeId, architecture: null })),
  };
  const unchanged = applyEventStormingDddConversion({ ...editor, historyLimit: 0 }, source, {
    mappings,
    consent: null,
  });
  expect(unchanged.type).toBe('unchanged');
  expect('conversion' in unchanged).toBe(false);
  const result = applyEventStormingDddConversion(editor, source, options);
  if (result.type !== 'applied') throw new Error('Expected applied fixture');
  expect(applyEventStormingDddConversion(result.editor, source, options).type).toBe('blocked');
  const undone = updateEditor(result.editor, { type: 'UndoPressed' });
  expect(applyEventStormingDddConversion(undone, source, options).type).toBe('blocked');
  expect(applyEventStormingDddConversion(undone, withEditor(source, undone), options).type).toBe(
    'blocked',
  );
});

test('portable receipt round-trips complete before/after documents and validates semantic replacements', () => {
  const { editor, source, options } = fixture();
  const result = applyEventStormingDddConversion(editor, source, options);
  if (result.type !== 'applied') throw new Error('Expected applied fixture');
  const json = serializeEventStormingDddConversion(result.conversion),
    reopened = parseEventStormingDddConversion(json);
  expect(reopened).toEqual(result.conversion);
  expect(parseModelDocument(serializeModelDocument(reopened.source.document))).toEqual(
    captureModelDocument(source.document),
  );
  expect(parseModelDocument(serializeModelDocument(reopened.document))).toEqual(
    result.conversion.document,
  );
  const wire = JSON.parse(json);
  wire.document.snapshot.graph.nodes[1].label = 'Forged extra edit';
  expect(() => parseEventStormingDddConversion(JSON.stringify(wire))).toThrow();
  expect(() =>
    serializeEventStormingDddConversion({
      ...result.conversion,
      document: { ...result.conversion.document, name: 'Forged model name' },
    }),
  ).toThrow();
  expect(() =>
    parseEventStormingDddConversion('{"format":"foldkit-zloz-ddd-conversion","version":2}'),
  ).toThrow();
  expect(() => parseEventStormingDddConversion('{')).toThrow();
});

test('receipt parser rejects malformed and unacknowledged literal records, unknown fields and altered conventions', () => {
  const { editor, source, options } = fixture();
  const result = applyEventStormingDddConversion(editor, source, options);
  if (result.type !== 'applied') throw new Error('Expected applied fixture');
  const json = serializeEventStormingDddConversion(result.conversion);
  for (const patch of [
    { version: 0 },
    { lossesAccepted: false },
    { extra: true },
    { source: null },
    { mappings: { nodes: [{ nodeId: 'a', architecture: { family: 'c4', role: 'person' } }] } },
  ])
    expect(() =>
      parseEventStormingDddConversion(JSON.stringify({ ...JSON.parse(json), ...patch })),
    ).toThrow();
  const altered = JSON.parse(json);
  altered.mappings.relationships.rules = [];
  expect(() => parseEventStormingDddConversion(JSON.stringify(altered))).toThrow();
});

test('malformed input or a throwing policy leaves the original editor recoverable', () => {
  const { editor, source, options } = fixture(),
    before = JSON.stringify(editor);
  expect(() =>
    applyEventStormingDddConversion(editor, source, {
      ...options,
      mappings: { nodes: [{ nodeId: 'missing', architecture: null }] },
    }),
  ).toThrow();
  expect(() =>
    applyEventStormingDddConversion(editor, source, {
      ...options,
      policy: {
        canChangeEdgeArchitecture: () => {
          throw new Error('Host failure');
        },
      },
    }),
  ).toThrow('Host failure');
  expect(JSON.stringify(editor)).toBe(before);
});
