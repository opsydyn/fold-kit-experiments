import assert from 'node:assert/strict';

import { expect, test } from 'vitest';

import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { update } from '../src/editor/update';
import { workbenchWorkshopContext } from '../src/editor/workshop';
function ready(id = 'retry-question'): Model {
  const loaded = update(
    init().model,
    Message.SelectedExample({ example: 'event-storming-workshop' }),
  ).model;
  return {
    ...loaded,
    sidebarSection: 'inspect',
    editor: { ...loaded.editor, surface: { width: 1100, height: 800 }, selectedNodes: [id] },
  };
}
function request(model: Model, value: string) {
  const scope = workbenchWorkshopContext(model).scope;
  assert(scope);
  return Message.ObservedWorkshopInput({
    modelId: model.modelIdentity.id,
    epoch: model.modelEpoch,
    request: { ...scope, type: 'StatusSelected', value },
  });
}
test('workshop starter opts into its convention and editing native status preserves description, topology and one Undo', () => {
  const model = ready();
  expect(model.workshopConventions).toBe(true);
  expect(model.nodeDesign).toBe('event-storming');
  const next = update(model, request(model, 'resolved')).model;
  expect(next.editor.graph.nodes.find((n) => n.id === 'retry-question')?.architecture).toEqual({
    family: 'event-storming',
    role: 'hotspot',
    status: 'resolved',
    description: 'Clarify the handoff after a provider timeout.',
  });
  expect(next.editor.past).toHaveLength(1);
  expect(next.editor.graph.edges).toEqual(model.editor.graph.edges);
  expect(update(next, request(model, 'resolved')).model).toBe(next);
  const undone = update(
    next,
    Message.ObservedZlozInput({ message: { type: 'UndoPressed' } }),
  ).model;
  expect(undone.editor.graph).toEqual(model.editor.graph);
});
test('live facilitator protection has visible reasons and can be disabled without mutating the graph', () => {
  const model = ready('timeout-agreement'),
    input = request(model, 'open');
  expect(workbenchWorkshopContext(model).status?.reason).toContain('facilitator');
  expect(update(model, input).model.editor).toBe(model.editor);
  const unlocked = update(model, Message.ClickedWorkshopProtection()).model;
  expect(unlocked.editor).toBe(model.editor);
  expect(workbenchWorkshopContext(unlocked).status?.reason).toBeNull();
  const changed = update(unlocked, input).model;
  expect(changed.editor.past).toHaveLength(1);
  expect(
    changed.editor.graph.nodes.find((n) => n.id === 'timeout-agreement')?.architecture,
  ).toMatchObject({ status: 'open' });
});
test('stale epochs, hidden inspectors, selection changes, imports and read-only editor cannot use old status controls', () => {
  const model = ready(),
    input = request(model, 'resolved');
  for (const stale of [
    { ...input, epoch: input.epoch - 1 },
    { ...input, modelId: 'other' },
  ])
    expect(update(model, stale).model).toBe(model);
  for (const other of [
    { ...model, sidebarSection: 'diagram' as const },
    { ...model, editor: { ...model.editor, selectedNodes: ['provider'] } },
    { ...model, editor: { ...model.editor, readOnly: true } },
    { ...model, importing: { id: 1, revision: model.editor.revision } },
  ])
    expect(update(other, input).model.editor).toBe(other.editor);
});
