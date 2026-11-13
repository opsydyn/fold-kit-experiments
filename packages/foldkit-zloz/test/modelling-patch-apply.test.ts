import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  captureModellingPatch,
  createEditor,
  updateEditor,
  resolveModellingPatchReview,
  applyModellingPatch,
  type ZlozModellingPatchConsent,
  type EditorPolicy,
} from '../src/index';
import wire from './fixtures/modelling-patch-v1.json';
const literal = captureModellingPatch(wire);
const identity = { modelId: 'commerce', sessionId: 'commerce/session-1' };
const editor = () => ({ ...createEditor(literal.source.graph), revision: 7 });
const consent = (key: string): ZlozModellingPatchConsent => ({
  key,
  reviewed: true,
  lossesAccepted: true,
});
test('Apply rebuilds exact review, commits once and returns provenance alongside editor; Undo/Redo is atomic', () => {
  const before = editor();
  const originalNode = literal.source.graph.nodes[0];
  assert(originalNode);
  const batch = captureModellingPatch({
    ...literal,
    operations: [
      ...literal.operations,
      {
        id: 'add-context',
        type: 'node.add',
        node: { ...originalNode, id: 'payments', label: 'Payments' },
      },
    ],
  });
  const review = resolveModellingPatchReview(before, identity, batch);
  assert(review.key);
  expect(applyModellingPatch(before, identity, batch, { consent: null }).type).toBe('blocked');
  const result = applyModellingPatch(before, identity, batch, { consent: consent(review.key) });
  assert(result.type === 'applied');
  expect(result.editor.graph.nodes[0]?.label).toBe('Order management');
  expect(result.editor.graph.nodes).toHaveLength(2);
  expect(result.editor.past).toHaveLength(1);
  expect(result.receipt.patch.provenance.reason).toContain('Clarify');
  expect(Object.isFrozen(result.receipt.graph.nodes)).toBe(true);
  const undo = updateEditor(result.editor, { type: 'UndoPressed' });
  expect(undo.graph).toEqual(before.graph);
  expect(updateEditor(undo, { type: 'RedoPressed' }).graph).toEqual(result.editor.graph);
  expect(result.receipt.revision).toBe(8);
  expect(before.past).toEqual([]);
});
test('source, content, live protection, lifecycle and Undo checks preserve editor by reference', () => {
  const before = editor(),
    review = resolveModellingPatchReview(before, identity, literal);
  assert(review.key);
  const accepted = consent(review.key);
  for (const candidate of [
    { ...before, revision: 8 },
    { ...before, readOnly: true },
    { ...before, historyLimit: 0 },
    { ...before, connection: { node: 'orders', port: 'missing' } },
  ]) {
    const result = applyModellingPatch(candidate, identity, literal, { consent: accepted });
    expect(result.type).toBe('blocked');
    expect(result.editor).toBe(candidate);
  }
  const changed = { ...literal, provenance: { ...literal.provenance, reason: 'Changed meaning' } };
  expect(applyModellingPatch(before, identity, changed, { consent: accepted }).type).toBe(
    'blocked',
  );
  expect(
    applyModellingPatch(before, identity, literal, { consent: accepted, blockedReason: '' }).type,
  ).toBe('blocked');
  expect(
    applyModellingPatch(before, { ...identity, sessionId: 'new' }, literal, { consent: accepted })
      .type,
  ).toBe('blocked');
});
test('granular semantic and geometry protection is enforced on full replacements', () => {
  const before = editor();
  const n = literal.source.graph.nodes[0];
  assert(n);
  for (const [field, value, policy] of [
    ['position', { x: 20, y: 0 }, { canMoveNode: () => 'Move locked' }],
    ['size', { width: 300, height: 160 }, { canResizeNode: () => 'Size locked' }],
    [
      'architecture',
      { family: 'c4', role: 'software-system' },
      { canChangeNodeArchitecture: () => 'Meaning locked' },
    ],
    [
      'appearance',
      // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Authored outline geometry is domain data.
      { shape: 'rounded-rectangle' },
      { canChangeNodeAppearance: () => 'Outline locked' },
    ],
  ] as const) {
    const patch = {
      ...literal,
      operations: [{ id: 'edit', type: 'node.replace' as const, node: { ...n, [field]: value } }],
    };
    const review = resolveModellingPatchReview(before, identity, patch);
    assert(review.key);
    const result = applyModellingPatch(before, identity, patch, {
      consent: consent(review.key),
      policy,
    });
    expect(result.type).toBe('blocked');
    expect(result.editor).toBe(before);
  }
  const policy: EditorPolicy = { canDelete: () => 'Required' };
  const patch = {
    ...literal,
    operations: [{ id: 'remove', type: 'node.remove' as const, nodeId: 'orders' }],
  };
  const review = resolveModellingPatchReview(before, identity, patch);
  assert(review.key);
  expect(
    applyModellingPatch(before, identity, patch, { consent: consent(review.key), policy }).type,
  ).toBe('blocked');
});

test('ports, connection locks, edge meaning and waypoint policies cannot be bypassed by whole replacements', () => {
  const portNode = (id: string) => ({
    id,
    label: id,
    position: { x: 0, y: 0 },
    size: { width: 120, height: 80 },
    ports: [
      { id: 'out', kind: 'output' as const, side: 'right' as const, offset: 0.5 },
      { id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 },
    ],
  });
  const a = portNode('a'),
    b = portNode('b'),
    c = portNode('c'),
    edge = { id: 'e', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } };
  const before = createEditor({ nodes: [a, b, c], edges: [edge] });
  const source = { ...identity, revision: before.revision, graph: before.graph };
  const blocked = (
    operations: readonly import('../src/index').ZlozModellingPatchOperation[],
    policy: EditorPolicy,
  ) => {
    const patch = captureModellingPatch({ ...literal, source, operations });
    const review = resolveModellingPatchReview(before, identity, patch);
    assert(review.key);
    const result = applyModellingPatch(before, identity, patch, {
      consent: consent(review.key),
      policy,
    });
    expect(result.type).toBe('blocked');
    expect(result.editor).toBe(before);
  };
  blocked(
    [
      {
        id: 'label',
        type: 'node.replace',
        node: { ...a, ports: a.ports.map((p) => ({ ...p, label: 'new' })) },
      },
    ],
    {
      canEditPort: (candidate) => {
        expect(Object.isFrozen(candidate)).toBe(true);
        return 'Port locked';
      },
    },
  );
  blocked([{ id: 'order', type: 'node.replace', node: { ...a, ports: [...a.ports].reverse() } }], {
    canEditPort: () => '',
  });
  blocked(
    [
      {
        id: 'add',
        type: 'node.replace',
        node: {
          ...a,
          ports: [...a.ports, { id: 'new', kind: 'output', side: 'right', offset: 0.3 }],
        },
      },
    ],
    { canEditPort: () => 'Port creation locked' },
  );
  blocked(
    [{ id: 'wire', type: 'edge.replace', edge: { ...edge, target: { node: 'c', port: 'in' } } }],
    { canReconnect: () => 'End locked' },
  );
  blocked(
    [{ id: 'wire', type: 'edge.replace', edge: { ...edge, target: { node: 'c', port: 'in' } } }],
    { canConnectPort: () => 'Port closed' },
  );
  blocked(
    [{ id: 'wire', type: 'edge.replace', edge: { ...edge, target: { node: 'c', port: 'in' } } }],
    { canConnect: () => 'Connection denied' },
  );
  blocked(
    [
      {
        id: 'route',
        type: 'edge.replace',
        edge: { ...edge, waypoints: [{ id: 'bend', position: { x: 40, y: 40 } }] },
      },
    ],
    { canChangeEdgeWaypoints: () => 'Route locked' },
  );
  blocked(
    [
      {
        id: 'meaning',
        type: 'edge.replace',
        edge: { ...edge, architecture: { family: 'event-storming', role: 'produces' } },
      },
    ],
    { canChangeEdgeArchitecture: () => 'Meaning locked' },
  );
  const patch = captureModellingPatch({
    ...literal,
    source,
    operations: [{ id: 'rename', type: 'node.replace', node: { ...a, label: 'Renamed' } }],
  });
  const review = resolveModellingPatchReview(before, identity, patch);
  assert(review.key);
  const result = applyModellingPatch(before, identity, patch, {
    consent: consent(review.key),
    review: { canPatch: () => 'Whole patch denied' },
  });
  expect(result.type).toBe('blocked');
  expect(result.editor).toBe(before);
});

test('target-only reconnection retains a closed existing source and custom callbacks receive frozen graphs', () => {
  const node = (id: string) => ({
    id,
    label: id,
    position: { x: 0, y: 0 },
    size: { width: 120, height: 80 },
    ports: [
      { id: 'out', kind: 'output' as const, side: 'right' as const, offset: 0.5 },
      { id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 },
    ],
  });
  const e = { id: 'e', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } };
  const before = createEditor({ nodes: [node('a'), node('b'), node('c')], edges: [e] });
  const patch = captureModellingPatch({
    ...literal,
    source: { ...identity, revision: 0, graph: before.graph },
    operations: [
      { id: 'retarget', type: 'edge.replace', edge: { ...e, target: { node: 'c', port: 'in' } } },
    ],
  });
  const review = resolveModellingPatchReview(before, identity, patch);
  assert(review.key);
  const result = applyModellingPatch(before, identity, patch, {
    consent: consent(review.key),
    policy: {
      canConnectPort: (ep) => (ep.node === 'a' ? 'Source is closed to new connections' : null),
      canConnect: (_edge, graph) => {
        expect(Object.isFrozen(graph)).toBe(true);
        expect(Object.isFrozen(graph.edges)).toBe(true);
        return null;
      },
    },
  });
  expect(result.type).toBe('applied');
  expect(result.editor.past).toHaveLength(1);
  const noop = captureModellingPatch({
    ...literal,
    source: { ...identity, revision: 0, graph: before.graph },
    operations: [],
  });
  const unchanged = applyModellingPatch(before, identity, noop, { consent: null });
  expect(unchanged.type).toBe('unchanged');
  expect(unchanged.editor).toBe(before);
  expect('receipt' in unchanged).toBe(false);
});
