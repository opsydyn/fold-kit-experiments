import { expect, test } from 'bun:test';

import {
  createEditor,
  createEventStormingPattern,
  updateEditor,
  eventStormingRelationshipPolicy,
  eventStormingRelationshipRules,
  resolveEventStormingRelationshipControls,
  resolveEventStormingRelationshipRequest,
  type ZlozEventStormingRelationshipRequest,
} from '../src/index';
const state = () => createEditor(createEventStormingPattern({ includeAggregate: true }));
test('clear and explicit inference use fresh events with ordinary Undo; same-key choices preserve authored descriptions', () => {
  const editor = state();
  const options = { policy: eventStormingRelationshipPolicy() };
  const context = resolveEventStormingRelationshipControls(editor, 'step:0', options);
  expect(context.value).toBe('issues');
  expect(context.inference.reason).not.toBeNull();
  const clear = resolveEventStormingRelationshipRequest(
    editor,
    'step:0',
    { type: 'RelationshipSelected', edgeId: 'step:0', key: null },
    options,
  );
  if (clear.type !== 'ready') throw new Error('Clear blocked');
  const untyped = updateEditor(editor, clear.event, options.policy);
  expect(untyped.past).toHaveLength(1);
  const inferred = resolveEventStormingRelationshipRequest(
    untyped,
    'step:0',
    { type: 'InferenceApplied', edgeId: 'step:0' },
    options,
  );
  if (inferred.type !== 'ready') throw new Error('Inference blocked');
  expect(inferred.event.architecture?.role).toBe('issues');
  const typed = updateEditor(untyped, inferred.event, options.policy);
  expect(updateEditor(typed, { type: 'UndoPressed' }).graph).toEqual(untyped.graph);
  const described = updateEditor(editor, {
    type: 'EdgeArchitectureChanged',
    id: 'step:0',
    architecture: { family: 'event-storming', role: 'issues', description: 'Authored meaning' },
  });
  expect(
    resolveEventStormingRelationshipRequest(
      described,
      'step:0',
      { type: 'RelationshipSelected', edgeId: 'step:0', key: 'issues' },
      options,
    ),
  ).toEqual({ type: 'unchanged' });
  expect(described.graph.edges[0]?.architecture?.description).toBe('Authored meaning');
});
test('convention diagnostics stay independent of enforcement, while current policy and lifecycle protect every path', () => {
  const editor = state();
  const free = resolveEventStormingRelationshipControls(editor, 'step:0');
  expect(free.choices.find((choice) => choice.key === 'emits')?.compatibilityReason).toContain(
    'does not allow',
  );
  expect(free.choices.find((choice) => choice.key === 'emits')?.reason).toBeNull();
  const request: ZlozEventStormingRelationshipRequest = {
    type: 'RelationshipSelected',
    edgeId: 'step:0',
    key: 'emits',
  };
  expect(resolveEventStormingRelationshipRequest(editor, 'step:0', request).type).toBe('ready');
  expect(
    resolveEventStormingRelationshipRequest(editor, 'step:0', request, {
      policy: eventStormingRelationshipPolicy(),
    }).type,
  ).toBe('blocked');
  const locked = resolveEventStormingRelationshipControls(editor, 'step:0', {
    policy: { canChangeEdgeArchitecture: () => 'Managed edge' },
  });
  expect(locked.choices.every((choice) => choice.reason === 'Managed edge')).toBe(true);
  const untyped = updateEditor(editor, {
    type: 'EdgeArchitectureChanged',
    id: 'step:0',
    architecture: null,
  });
  expect(
    resolveEventStormingRelationshipRequest(
      untyped,
      'step:0',
      { type: 'InferenceApplied', edgeId: 'step:0' },
      { policy: { canChangeEdgeArchitecture: () => 'New policy' } },
    ),
  ).toEqual({ type: 'blocked', reason: 'New policy' });
  expect(
    resolveEventStormingRelationshipControls({ ...editor, readOnly: true }, 'step:0').reason,
  ).toContain('read-only');
  const panning = updateEditor(editor, { type: 'PanStarted', pointer: 1, point: { x: 0, y: 0 } });
  expect(resolveEventStormingRelationshipRequest(panning, 'step:0', request).type).toBe('blocked');
  expect(
    resolveEventStormingRelationshipControls(editor, 'step:0', { blockedReason: ' ' }).reason
      ?.length,
  ).toBeGreaterThan(0);
});
test('unknown keys and changed inspector targets never silently clear or edit another edge', () => {
  const editor = state();
  expect(
    resolveEventStormingRelationshipRequest(editor, 'step:0', {
      type: 'RelationshipSelected',
      edgeId: 'step:0',
      key: 'missing',
    }),
  ).toEqual({ type: 'ignored' });
  expect(
    resolveEventStormingRelationshipRequest(editor, 'step:1', {
      type: 'InferenceApplied',
      edgeId: 'step:0',
    }),
  ).toEqual({ type: 'ignored' });
  expect(
    resolveEventStormingRelationshipRequest(editor, null, {
      type: 'InferenceApplied',
      edgeId: 'step:0',
    }),
  ).toEqual({ type: 'ignored' });
  const custom = updateEditor(editor, {
    type: 'EdgeArchitectureChanged',
    id: 'step:0',
    architecture: { family: 'event-storming', role: 'custom', name: 'outside' },
  });
  const context = resolveEventStormingRelationshipControls(custom, 'step:0');
  expect(context.value).toBe('custom:outside');
  expect(context.choices.find((choice) => choice.key === 'custom:outside')?.currentOnly).toBe(true);
  expect(
    resolveEventStormingRelationshipRequest(custom, 'step:0', {
      type: 'RelationshipSelected',
      edgeId: 'step:0',
      key: 'custom:outside',
    }),
  ).toEqual({ type: 'ignored' });
  expect(custom.graph.edges[0]?.architecture?.role).toBe('custom');
  expect(resolveEventStormingRelationshipControls(editor, 'missing').edge).toBeNull();
});
test('custom keys remain distinct and ambiguous inference never chooses an arbitrary rule', () => {
  const editor = updateEditor(state(), {
    type: 'EdgeArchitectureChanged',
    id: 'step:0',
    architecture: null,
  });
  const conventions = {
    rules: [
      ...eventStormingRelationshipRules,
      ...['a', 'b'].map((name) => ({
        architecture: { family: 'event-storming' as const, role: 'custom' as const, name },
        sources: ['actor' as const],
        targets: ['command' as const],
        label: name,
      })),
    ],
  };
  const context = resolveEventStormingRelationshipControls(editor, 'step:0', { conventions });
  expect(
    context.choices
      .filter((choice) => choice.key?.startsWith('custom:'))
      .map((choice) => choice.key),
  ).toEqual(['custom:a', 'custom:b']);
  expect(context.inference.reason).toContain('Several relationships');
  const decision = resolveEventStormingRelationshipRequest(
    editor,
    'step:0',
    { type: 'RelationshipSelected', edgeId: 'step:0', key: 'custom:b' },
    { conventions, policy: eventStormingRelationshipPolicy(conventions) },
  );
  if (decision.type !== 'ready') throw new Error('Custom selection blocked');
  expect(decision.event.architecture).toEqual({
    family: 'event-storming',
    role: 'custom',
    name: 'b',
  });
});

test('empty inspectors still validate convention configuration and can localize native control labels', () => {
  const rule = eventStormingRelationshipRules[0];
  if (!rule) throw new Error('Missing rule');
  expect(() =>
    resolveEventStormingRelationshipControls(createEditor({ nodes: [], edges: [] }), null, {
      conventions: { rules: [rule, rule] },
    }),
  ).toThrow();
  const context = resolveEventStormingRelationshipControls(state(), 'step:0', {
    label: 'Relationship',
    clearLabel: 'No explicit meaning',
    inferenceLabel: 'Infer',
    labelRule: (rule) => `Kind ${rule.label}`,
  });
  expect(context.label).toBe('Relationship');
  expect(context.choices[0]?.label).toBe('No explicit meaning');
  expect(context.inference.label).toBe('Infer');
  expect(context.choices[1]?.label).toBe('Kind Issues');
});
