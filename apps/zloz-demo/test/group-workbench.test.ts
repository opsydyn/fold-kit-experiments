import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { Message, Model, update, type ReadyState } from '../src/group-workbench/main';
function ready(model: Model): ReadyState {
  if (model._tag !== 'Ready') throw new Error('Expected ready fixture.');
  // SAFETY: Test models are created only by the application's typed initializer/transitions.
  return model.state as ReadyState;
}
const initial = () =>
  update(Model.Preparing(), Message.SucceededIdentity({ id: 'app-v3-test' })).model;
const input = (
  model: Model,
  event: Parameters<typeof Message.ObservedWorkbenchInput>[0]['event'],
) => update(model, Message.ObservedWorkbenchInput({ event })).model;
test('workbench saves live camera with a checkpoint, restores the full document and retains independent read-only review', () => {
  let model = initial();
  model = input(model, { type: 'ViewportNudged', delta: { x: 30, y: 20 } });
  model = update(model, Message.ClickedCheckpoint()).model;
  const first = ready(model).catalogue.editions[0];
  expect(first?.snapshot.viewport).toEqual({ x: 50, y: 40, zoom: 1 });
  model = input(model, { type: 'NodeSelected', id: 'orders', additive: false });
  model = input(model, { type: 'SelectionNudged', delta: { x: 20, y: 0 } });
  const working = ready(model).workbench;
  assert(first);
  model = update(model, Message.ClickedReview({ id: first?.id ?? '' })).model;
  expect(ready(model).review?.workbench.editor.readOnly).toBe(true);
  model = input(model, { type: 'DeletePressed' });
  expect(ready(model).workbench).toBe(working);
  model = update(model, Message.ClickedRestore()).model;
  expect(ready(model).review).toBeNull();
  expect(ready(model).workbench.editor.document).toEqual(first.snapshot);
  model = input(model, { type: 'UndoPressed' });
  expect(ready(model).workbench.editor.document).toEqual(working.editor.document);
});
test('late model-open completions cannot overwrite newer requests or intervening graph edits', () => {
  let model = initial();
  const document = { ...ready(model).catalogue, snapshot: ready(model).workbench.editor.document };
  model = update(model, Message.ClickedOpen()).model;
  model = update(model, Message.ClickedOpen()).model;
  expect(update(model, Message.SucceededOpen({ document, id: 'old', token: 1 })).model).toBe(model);
  model = input(model, { type: 'NodeSelected', id: 'orders', additive: false });
  model = input(model, { type: 'SelectionNudged', delta: { x: 20, y: 0 } });
  const changed = ready(model).workbench.editor;
  model = update(model, Message.SucceededOpen({ document, id: 'late', token: 2 })).model;
  expect(ready(model).workbench.editor).toBe(changed);
  expect(ready(model).notice).toContain('Current edits were retained');
  model = update(model, Message.ClickedOpen()).model;
  model = update(model, Message.SucceededOpen({ document, id: 'new-incarnation', token: 3 })).model;
  expect(ready(model).workbench.editor.sessionId).toBe('new-incarnation');
  expect(ready(model).workbench.editor.history.past).toEqual([]);
});
