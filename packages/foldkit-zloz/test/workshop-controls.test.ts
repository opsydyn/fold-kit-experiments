import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  parseGraph,
  createEditor,
  updateEditor,
  resolveEventStormingWorkshopControls,
  resolveEventStormingWorkshopRequest,
} from '../src/index';
import wire from './fixtures/workshop-v1.json';
const ready = () => ({
  ...createEditor(parseGraph(JSON.stringify(wire))),
  selectedNodes: ['hotspot'],
});
test('workshop status preserves description and returns one ordinary Undoable architecture event', () => {
  const editor = ready(),
    context = resolveEventStormingWorkshopControls(editor, 'hotspot');
  assert(context.scope && context.status);
  expect(context.status.value).toBe('open');
  const request = { ...context.scope, type: 'StatusSelected' as const, value: 'resolved' };
  const decision = resolveEventStormingWorkshopRequest(editor, 'hotspot', request);
  assert(decision.type === 'ready');
  expect(decision.event).toEqual({
    type: 'NodeArchitectureChanged',
    id: 'hotspot',
    architecture: {
      family: 'event-storming',
      role: 'hotspot',
      status: 'resolved',
      description: 'Clarify retry ownership',
    },
  });
  const next = updateEditor(editor, decision.event);
  expect(next.past).toHaveLength(1);
  expect(updateEditor(next, { type: 'UndoPressed' }).graph).toEqual(editor.graph);
  expect(
    resolveEventStormingWorkshopRequest(editor, 'hotspot', { ...request, value: 'open' }),
  ).toEqual({ type: 'unchanged' });
  expect(
    resolveEventStormingWorkshopRequest(editor, 'hotspot', { ...request, value: 'closed' }),
  ).toEqual({ type: 'ignored' });
});
test('role controls expose kind/port protection and never silently change topology or unrelated meaning', () => {
  const editor = ready();
  const system = { ...editor, selectedNodes: ['system'] };
  const context = resolveEventStormingWorkshopControls(system, 'system');
  assert(context.scope);
  expect(context.role.choices.find((c) => c.key === 'hotspot')?.reason).toContain('ports');
  expect(context.role.choices.find((c) => c.key === 'lane')?.reason).toContain('group');
  expect(
    resolveEventStormingWorkshopRequest(system, 'system', {
      ...context.scope,
      type: 'RoleSelected',
      key: 'hotspot',
    }).type,
  ).toBe('blocked');
  const allowed = resolveEventStormingWorkshopRequest(editor, 'hotspot', {
    ...resolveEventStormingWorkshopControls(editor, 'hotspot').scope!,
    type: 'RoleSelected',
    key: 'external-system',
  });
  assert(allowed.type === 'ready');
  expect(allowed.event.architecture).toEqual({
    family: 'event-storming',
    role: 'external-system',
    description: 'Clarify retry ownership',
  });
  const lane = resolveEventStormingWorkshopControls({ ...editor, selectedNodes: ['lane'] }, 'lane');
  expect(lane.status).toBeNull();
  expect(lane.role.value).toBe('lane');
  expect(lane.role.choices.filter((c) => c.reason === null).map((c) => c.key)).toEqual(['lane']);
});
test('requests recheck identity, selection, visibility, read-only, gestures and live policies', () => {
  const editor = ready(),
    context = resolveEventStormingWorkshopControls(editor, 'hotspot');
  assert(context.scope);
  const request = { ...context.scope, type: 'StatusSelected' as const, value: 'resolved' };
  for (const stale of [
    { ...request, revision: request.revision + 1 },
    { ...request, descriptor: 'old' },
    { ...request, nodeId: 'other' },
  ])
    expect(resolveEventStormingWorkshopRequest(editor, 'hotspot', stale)).toEqual({
      type: 'ignored',
    });
  for (const state of [
    { ...editor, readOnly: true },
    { ...editor, selectedNodes: [] },
    { ...editor, collapsedGroups: ['lane'] },
    { ...editor, visibility: { hiddenNodeIds: ['hotspot'] } },
  ])
    expect(resolveEventStormingWorkshopRequest(state, 'hotspot', request).type).toBe('blocked');
  const busy = updateEditor(editor, { type: 'PanStarted', pointer: 1, point: { x: 10, y: 10 } });
  expect(busy.gesture.type).not.toBe('idle');
  expect(resolveEventStormingWorkshopRequest(busy, 'hotspot', request).type).toBe('blocked');
  const policy = { canChangeNodeArchitecture: () => 'Facilitator locked this note.' };
  expect(resolveEventStormingWorkshopControls(editor, 'hotspot', { policy }).status?.reason).toBe(
    'Facilitator locked this note.',
  );
  expect(resolveEventStormingWorkshopRequest(editor, 'hotspot', request, { policy })).toEqual({
    type: 'blocked',
    reason: 'Facilitator locked this note.',
  });
  expect(
    resolveEventStormingWorkshopRequest(editor, 'hotspot', request, {
      blockedReason: 'Finish import',
    }),
  ).toEqual({ type: 'blocked', reason: 'Finish import' });
});

test('port addition to workshop annotations and frames returns a capability reason without graph changes or Undo', () => {
  const state = ready();
  for (const nodeId of ['hotspot', 'lane']) {
    const next = updateEditor(state, {
      type: 'PortAdded',
      nodeId,
      port: { id: 'new', kind: 'output', side: 'right', offset: 0.5 },
    });
    expect(next.graph).toBe(state.graph);
    expect(next.past).toBe(state.past);
    expect(next.notice).toContain('portless');
  }
});
