import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  applyEventStormingC4Conversion,
  createEventStormingC4ConversionPlan,
  createEditor,
  parseGraph,
  updateEditor,
  captureEdition,
  type ZlozEventStormingC4ConversionOptions,
  type ZlozEventStormingC4Source,
  type ZlozEventStormingC4ApplyPolicy,
  type EditorState,
} from '../src/index';
import wire from './fixtures/workshop-v1.json';

function fixture() {
  const graph = parseGraph(JSON.stringify(wire));
  const editor = createEditor(
    {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === 'system'
          ? { ...n, extent: 'parent' as const, expandParent: false, data: { retained: true } }
          : n,
      ),
    },
    { viewport: { x: 30, y: 40, zoom: 0.8 } },
  );
  const source: ZlozEventStormingC4Source = {
    sessionId: 'workshop:1',
    revision: editor.revision,
    document: {
      id: 'payments',
      name: 'Payments',
      origin: null,
      snapshot: { graph: editor.graph, viewport: editor.viewport },
      editions: [captureEdition({ id: 'discovery', name: 'Discovery', snapshot: { graph } })],
    },
  };
  const conversion: ZlozEventStormingC4ConversionOptions = {
    mappings: {
      nodes: graph.nodes.map((n) =>
        n.id === 'system' || n.id === 'command'
          ? {
              nodeId: n.id,
              architecture: { family: 'c4', role: 'software-system' },
              label: `C4 ${n.id}`,
            }
          : { nodeId: n.id, architecture: null },
      ),
      edges: graph.edges.map((e) => ({
        edgeId: e.id,
        relationship: e.id === 'system-issues' ? { label: 'Requests payment' } : null,
      })),
    },
    memberships: ['system', 'command'].map((nodeId) => ({ nodeId, placement: { type: 'root' } })),
  };
  const plan = createEventStormingC4ConversionPlan(source, conversion);
  assert(plan.type === 'reviewable');
  return {
    editor,
    source,
    conversion,
    options: { conversion, consent: { planKey: plan.key, accepted: true as const } },
  };
}

test('publishes all reviewed changes with frozen provenance and exactly one Undo/Redo transaction', () => {
  const { editor, source, options } = fixture(),
    before = JSON.stringify({ editor, source });
  const result = applyEventStormingC4Conversion(editor, source, options);
  assert(result.type === 'applied');
  expect(result.editor.revision).toBe(editor.revision + 1);
  expect(result.editor.past).toEqual([editor.graph]);
  expect(result.editor.future).toEqual([]);
  const node = result.editor.graph.nodes.find((n) => n.id === 'system');
  const original = editor.graph.nodes.find((n) => n.id === 'system');
  assert(original);
  assert(node);
  expect(node).toEqual({
    ...original,
    architecture: { family: 'c4', role: 'software-system' },
    label: 'C4 system',
    parentId: undefined,
    extent: undefined,
    expandParent: undefined,
  });
  expect(Object.keys(node)).not.toContain('parentId');
  const edge = result.editor.graph.edges.find((e) => e.id === 'system-issues');
  expect(edge).toEqual({
    id: 'system-issues',
    source: { node: 'system', port: 'out' },
    target: { node: 'command', port: 'in' },
    label: 'Requests payment',
  });
  expect(result.conversion.source).toEqual(source);
  expect(result.conversion.document.snapshot.graph).toEqual(result.editor.graph);
  expect(result.conversion.document.editions).toEqual(source.document.editions);
  expect(Object.isFrozen(result.conversion.source.document.snapshot.graph.nodes[0])).toBe(true);
  expect(Object.isFrozen(result.conversion)).toBe(true);
  expect(result.conversion.options).toEqual(options.conversion);
  expect(JSON.stringify({ editor, source })).toBe(before);
  const undo = updateEditor(result.editor, { type: 'UndoPressed' });
  expect(undo.graph).toEqual(editor.graph);
  expect(updateEditor(undo, { type: 'RedoPressed' }).graph).toEqual(result.editor.graph);
});

test('live graph, camera and revision drift reject without a partial publication', () => {
  const { editor, source, options } = fixture();
  for (const live of [
    { ...editor, revision: editor.revision + 1 },
    { ...editor, viewport: { ...editor.viewport, x: 90 } },
    {
      ...editor,
      graph: { ...editor.graph, nodes: editor.graph.nodes.map((n) => ({ ...n, label: 'edited' })) },
    },
  ]) {
    const result = applyEventStormingC4Conversion(live, source, options);
    expect(result).toEqual({
      type: 'blocked',
      editor: live,
      code: 'source-changed',
      reason: expect.any(String),
    });
    expect(result.editor).toBe(live);
    expect('conversion' in result).toBe(false);
  }
});
test('current session, document, mappings, placement and revoked consent require a new exact acknowledgement', () => {
  const { editor, source, options } = fixture();
  for (const current of [
    { ...source, sessionId: 'new-session' },
    { ...source, document: { ...source.document, name: 'Renamed' } },
  ]) {
    expect(applyEventStormingC4Conversion(editor, current, options)).toMatchObject({
      type: 'blocked',
      code: 'consent-required',
    });
  }
  for (const current of [
    { ...options, consent: null },
    {
      ...options,
      conversion: {
        ...options.conversion,
        memberships: [
          { nodeId: 'system', placement: { type: 'organization' as const } },
          { nodeId: 'command', placement: { type: 'root' as const } },
        ],
      },
    },
    {
      ...options,
      conversion: {
        ...options.conversion,
        mappings: {
          ...options.conversion.mappings,
          nodes: options.conversion.mappings?.nodes?.map((n) =>
            n.architecture ? { ...n, label: 'Changed label' } : n,
          ),
        },
      },
    },
  ]) {
    expect(applyEventStormingC4Conversion(editor, source, current)).toMatchObject({
      type: 'blocked',
      code: 'consent-required',
    });
  }
});
test('read-only, busy and disabled Undo remain live gates', () => {
  const { editor, source, options } = fixture();
  const cases: readonly [EditorState, string][] = [
    [{ ...editor, readOnly: true }, 'read-only'],
    [{ ...editor, edgeLabelDraft: { id: 'system-issues', text: 'Draft' } }, 'busy'],
    [{ ...editor, historyLimit: 0 }, 'undo-disabled'],
  ];
  for (const [live, code] of cases)
    expect(applyEventStormingC4Conversion(live, source, options)).toMatchObject({
      type: 'blocked',
      code,
      editor: live,
    });
  expect(
    applyEventStormingC4Conversion(editor, source, { ...options, blockedReason: 'Layout pending' }),
  ).toMatchObject({ type: 'blocked', code: 'busy', reason: 'Layout pending' });
});
test('unresolved containment cannot be applied, even with a previous consent', () => {
  const { editor, source, options } = fixture();
  expect(
    applyEventStormingC4Conversion(editor, source, {
      ...options,
      conversion: { ...options.conversion, memberships: [] },
    }),
  ).toMatchObject({ type: 'blocked', code: 'unresolved-mapping' });
});
for (const hook of [
  'canChangeNodeArchitecture',
  'canChangeEdgeArchitecture',
  'canChangeC4NodeLabel',
  'canChangeC4EdgeLabel',
  'canChangeC4Membership',
  'canApplyEventStormingC4Conversion',
] as const) {
  test(`${hook} veto is atomic and reevaluated on each attempt`, () => {
    const { editor, source, options } = fixture();
    const policy: ZlozEventStormingC4ApplyPolicy = { [hook]: () => 'Protected by host' };
    const result = applyEventStormingC4Conversion(editor, source, { ...options, policy });
    expect(result).toEqual({
      type: 'blocked',
      editor,
      code: 'policy',
      reason: 'Protected by host',
    });
    expect(result.editor).toBe(editor);
    expect(applyEventStormingC4Conversion(editor, source, options).type).toBe('applied');
  });
}
test('granular hooks see detached full proposed values and the current source graph', () => {
  const { editor, source, options } = fixture();
  const result = applyEventStormingC4Conversion(editor, source, {
    ...options,
    policy: {
      canChangeC4Membership: (before, after, graph) => {
        expect(before.parentId).toBe('lane');
        expect(after.parentId).toBeUndefined();
        expect(after.label).toBe(`C4 ${before.id}`);
        expect(graph).toEqual(editor.graph);
        expect(graph).not.toBe(editor.graph);
        expect(Object.isFrozen(after)).toBe(true);
        return before.id === 'command' ? 'Second node blocked' : null;
      },
    },
  });
  expect(result).toMatchObject({ type: 'blocked', code: 'policy', reason: 'Second node blocked' });
  expect(result.editor).toBe(editor);
});
test('explicit retention is a no-op without a history entry or receipt', () => {
  const { editor, source } = fixture();
  const conversion = {
    mappings: {
      nodes: editor.graph.nodes.map((n) => ({ nodeId: n.id, architecture: null })),
      edges: editor.graph.edges.map((e) => ({ edgeId: e.id, relationship: null })),
    },
  };
  expect(applyEventStormingC4Conversion(editor, source, { conversion, consent: null })).toEqual({
    type: 'unchanged',
    editor,
  });
});

test('explicit containment is checked and protected even when the parent ID stays the same', () => {
  const { editor, source } = fixture();
  const conversion: ZlozEventStormingC4ConversionOptions = {
    mappings: {
      nodes: editor.graph.nodes.map((n) =>
        n.id === 'lane'
          ? { nodeId: n.id, architecture: { family: 'c4', role: 'software-system' } }
          : n.id === 'command'
            ? { nodeId: n.id, architecture: { family: 'c4', role: 'container', technology: 'Bun' } }
            : { nodeId: n.id, architecture: null },
      ),
      edges: editor.graph.edges.map((e) => ({ edgeId: e.id, relationship: null })),
    },
    memberships: editor.graph.nodes.map((n) => ({
      nodeId: n.id,
      placement: n.id === 'command' ? { type: 'contained', parentId: 'lane' } : { type: 'root' },
    })),
  };
  const plan = createEventStormingC4ConversionPlan(source, conversion);
  assert(plan.type === 'reviewable');
  const options = { conversion, consent: { planKey: plan.key, accepted: true as const } };
  expect(
    applyEventStormingC4Conversion(editor, source, {
      ...options,
      policy: {
        canChangeC4Membership: (before, after) =>
          before.id === 'command' && before.parentId === after.parentId
            ? 'No runtime containment'
            : null,
      },
    }),
  ).toMatchObject({ type: 'blocked', code: 'policy', reason: 'No runtime containment' });
  const result = applyEventStormingC4Conversion(editor, source, options);
  assert(result.type === 'applied');
  expect(result.editor.graph.nodes.find((n) => n.id === 'command')).toMatchObject({
    parentId: 'lane',
    architecture: { family: 'c4', role: 'container' },
  });
  expect(result.editor.graph.nodes.find((n) => n.id === 'system')?.parentId).toBeUndefined();
  expect(
    result.conversion.source.document.snapshot.graph.nodes.find((n) => n.id === 'system')
      ?.architecture,
  ).toEqual({ family: 'event-storming', role: 'external-system' });
  const invalid = {
    ...conversion,
    mappings: {
      ...conversion.mappings,
      nodes: conversion.mappings?.nodes?.map((n) =>
        n.nodeId === 'command'
          ? {
              nodeId: n.nodeId,
              architecture: { family: 'c4' as const, role: 'component' as const },
            }
          : n,
      ),
    },
  };
  expect(
    applyEventStormingC4Conversion(editor, source, { ...options, conversion: invalid }),
  ).toMatchObject({ type: 'blocked', code: 'unresolved-mapping' });
});

test('active gestures, connections and camera transitions block; missing source camera cannot establish freshness', () => {
  const { editor, source, options } = fixture();
  const connected = { ...editor, connection: { node: 'system', port: 'out' } };
  expect(applyEventStormingC4Conversion(connected, source, options)).toMatchObject({
    type: 'blocked',
    code: 'busy',
  });
  const busyStates: readonly EditorState[] = [
    {
      ...editor,
      gesture: { type: 'pan', pointer: 1, origin: { x: 0, y: 0 }, before: editor.viewport },
    },
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
  ];
  for (const live of busyStates)
    expect(applyEventStormingC4Conversion(live, source, options)).toMatchObject({
      type: 'blocked',
      code: 'busy',
    });
  const noCamera = {
    ...source,
    document: { ...source.document, snapshot: { graph: editor.graph } },
  };
  expect(applyEventStormingC4Conversion(editor, noCamera, options)).toMatchObject({
    type: 'blocked',
    code: 'source-changed',
  });
});
