import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  createEditor,
  createContextMapPattern,
  dddRelationshipPolicy,
  resolveDddRelationshipControls,
  resolveDddRelationshipRequest,
  updateEditor,
  type ZlozDddRelationshipRequest,
  type EditorState,
} from '../src/index';
const id = 'orders-billing';
function state() {
  return createEditor(createContextMapPattern());
}
function apply(editor: EditorState, request: ZlozDddRelationshipRequest) {
  const policy = dddRelationshipPolicy(),
    result = resolveDddRelationshipRequest(editor, id, request, { policy });
  assert(result.type === 'ready');
  return updateEditor(editor, result.event, policy);
}
test('side-role requests preserve syntax and one Undo; same values remain no-ops', () => {
  const initial = state();
  const context = resolveDddRelationshipControls(initial, id);
  expect(context.pattern.value).toBe('strategic:upstream-downstream');
  expect(context.upstream.map((r) => r.checked)).toEqual([true, true]);
  expect(context.downstream?.value).toBe('anti-corruption-layer');
  const one = apply(initial, {
    type: 'UpstreamRoleChanged',
    edgeId: id,
    revision: initial.revision,
    role: 'open-host-service',
    enabled: false,
  });
  const two = apply(one, {
    type: 'UpstreamRoleChanged',
    edgeId: id,
    revision: one.revision,
    role: 'published-language',
    enabled: false,
  });
  expect(two.graph.edges[0]?.architecture).toEqual({
    family: 'ddd',
    scope: 'strategic',
    role: 'upstream-downstream',
    downstream: 'anti-corruption-layer',
  });
  expect(two.past).toHaveLength(2);
  expect(updateEditor(two, { type: 'UndoPressed' }).graph).toEqual(one.graph);
  const none = apply(two, {
    type: 'DownstreamRoleSelected',
    edgeId: id,
    revision: two.revision,
    role: null,
  });
  expect(none.graph.edges[0]?.architecture).toEqual({
    family: 'ddd',
    scope: 'strategic',
    role: 'upstream-downstream',
  });
  expect(
    resolveDddRelationshipRequest(none, id, {
      type: 'DownstreamRoleSelected',
      edgeId: id,
      revision: none.revision,
      role: null,
    }),
  ).toEqual({ type: 'unchanged' });
});
test('explicit pattern transitions retain description, preserve directional annotations or remove them atomically', () => {
  const initial = state(),
    edge = initial.graph.edges[0];
  assert(edge?.architecture);
  const described = updateEditor(initial, {
    type: 'EdgeArchitectureChanged',
    id,
    architecture: { ...edge.architecture, description: 'Authored contract' },
  });
  const directional = apply(described, {
    type: 'PatternSelected',
    edgeId: id,
    revision: described.revision,
    key: 'strategic:customer-supplier',
  });
  expect(directional.graph.edges[0]?.architecture).toEqual({
    family: 'ddd',
    scope: 'strategic',
    role: 'customer-supplier',
    upstream: ['open-host-service', 'published-language'],
    downstream: 'anti-corruption-layer',
    description: 'Authored contract',
  });
  const symmetric = apply(directional, {
    type: 'PatternSelected',
    edgeId: id,
    revision: directional.revision,
    key: 'strategic:partnership',
  });
  expect(symmetric.graph.edges[0]?.architecture).toEqual({
    family: 'ddd',
    scope: 'strategic',
    role: 'partnership',
    description: 'Authored contract',
  });
  expect(resolveDddRelationshipControls(symmetric, id).upstream).toEqual([]);
  expect(resolveDddRelationshipControls(symmetric, id).downstream).toBeNull();
  expect(updateEditor(symmetric, { type: 'UndoPressed' }).graph).toEqual(directional.graph);
  expect(
    resolveDddRelationshipRequest(symmetric, id, {
      type: 'PatternSelected',
      edgeId: id,
      revision: symmetric.revision,
      key: 'strategic:partnership',
    }),
  ).toEqual({ type: 'unchanged' });
});
test('live protections, lifecycle, inspector and revision apply to every request without conflating compatibility', () => {
  const editor = state(),
    request: ZlozDddRelationshipRequest = {
      type: 'PatternSelected',
      edgeId: id,
      revision: editor.revision,
      key: 'tactical:uses',
    };
  const free = resolveDddRelationshipControls(editor, id),
    choice = free.pattern.choices.find((c) => c.key === 'tactical:uses');
  assert(choice);
  expect(choice.compatibilityReason).toContain('does not allow');
  expect(choice.reason).toBeNull();
  const policy = dddRelationshipPolicy({}, { canChangeEdgeArchitecture: () => 'Managed contract' });
  const protectedControls = resolveDddRelationshipControls(editor, id, { policy });
  expect(protectedControls.pattern.reason).toBe('Managed contract');
  expect(protectedControls.upstream.every((r) => r.reason === 'Managed contract')).toBe(true);
  expect(resolveDddRelationshipRequest(editor, id, request, { policy })).toEqual({
    type: 'blocked',
    reason: 'Managed contract',
  });
  expect(
    resolveDddRelationshipRequest(editor, id, request, { policy: dddRelationshipPolicy() }).type,
  ).toBe('blocked');
  expect(resolveDddRelationshipRequest({ ...editor, readOnly: true }, id, request).type).toBe(
    'blocked',
  );
  expect(resolveDddRelationshipRequest(editor, 'billing-inventory', request).type).toBe('ignored');
  const changed = updateEditor(editor, {
    type: 'NodeLabelChanged',
    id: 'orders',
    label: 'Changed',
  });
  expect(resolveDddRelationshipRequest(changed, id, request).type).toBe('ignored');
  expect(
    resolveDddRelationshipRequest(editor, id, request, { blockedReason: 'Import active' }),
  ).toEqual({ type: 'blocked', reason: 'Import active' });
});
test('unknown custom meaning stays current-only; explicit clear is possible while another family stays protected', () => {
  const initial = state(),
    custom = updateEditor(initial, {
      type: 'EdgeArchitectureChanged',
      id,
      architecture: { family: 'ddd', scope: 'strategic', role: 'custom', name: 'affiliate' },
    });
  const context = resolveDddRelationshipControls(custom, id);
  expect(context.pattern.value).toBe('strategic:custom:affiliate');
  expect(context.pattern.choices.find((c) => c.key === context.pattern.value)?.currentOnly).toBe(
    true,
  );
  const clear = resolveDddRelationshipRequest(
    custom,
    id,
    { type: 'PatternSelected', edgeId: id, revision: custom.revision, key: null },
    { policy: dddRelationshipPolicy() },
  );
  assert(clear.type === 'ready');
  expect(clear.event.architecture).toBeNull();
  const foreign = updateEditor(initial, {
    type: 'EdgeArchitectureChanged',
    id,
    architecture: { family: 'event-storming', role: 'custom', name: 'other' },
  });
  expect(resolveDddRelationshipControls(foreign, id).reason).toContain('EventStorming');
  expect(
    resolveDddRelationshipRequest(foreign, id, {
      type: 'PatternSelected',
      edgeId: id,
      revision: foreign.revision,
      key: null,
    }).type,
  ).toBe('blocked');
});

test('directional transitions preserve authored absence rather than injecting catalogue defaults', () => {
  const initial = updateEditor(state(), {
    type: 'EdgeArchitectureChanged',
    id,
    architecture: {
      family: 'ddd',
      scope: 'strategic',
      role: 'upstream-downstream',
      description: 'No roles chosen',
    },
  });
  const rules = [
    {
      architecture: {
        family: 'ddd' as const,
        scope: 'strategic' as const,
        role: 'customer-supplier' as const,
        upstream: ['open-host-service' as const],
        downstream: 'conformist' as const,
      },
      sources: ['bounded-context' as const],
      targets: ['bounded-context' as const],
      label: 'Customer agreement',
      direction: 'directed' as const,
    },
  ];
  const result = resolveDddRelationshipRequest(
    initial,
    id,
    {
      type: 'PatternSelected',
      edgeId: id,
      revision: initial.revision,
      key: 'strategic:customer-supplier',
    },
    { conventions: { rules } },
  );
  assert(result.type === 'ready');
  expect(result.event.architecture).toEqual({
    family: 'ddd',
    scope: 'strategic',
    role: 'customer-supplier',
    description: 'No roles chosen',
  });
});
test('custom catalogues compose with policy and gestures block even a currently valid choice', () => {
  const editor = state();
  const rules = [
    {
      architecture: {
        family: 'ddd' as const,
        scope: 'strategic' as const,
        role: 'custom' as const,
        name: 'affiliate',
      },
      sources: ['bounded-context' as const],
      targets: ['bounded-context' as const],
      label: 'Affiliates',
      direction: 'symmetric' as const,
    },
  ];
  const options = { conventions: { rules }, policy: dddRelationshipPolicy({ rules }) };
  const request: ZlozDddRelationshipRequest = {
    type: 'PatternSelected',
    edgeId: id,
    revision: editor.revision,
    key: 'strategic:custom:affiliate',
  };
  const result = resolveDddRelationshipRequest(editor, id, request, options);
  assert(result.type === 'ready');
  expect(updateEditor(editor, result.event, options.policy).graph.edges[0]?.architecture).toEqual(
    rules[0]?.architecture,
  );
  const dragged = updateEditor(editor, {
    type: 'NodeDragStarted',
    id: 'orders',
    pointer: 1,
    point: { x: 80, y: 60 },
  });
  expect(dragged.gesture.type).not.toBe('idle');
  expect(resolveDddRelationshipRequest(dragged, id, request, options).type).toBe('blocked');
});
