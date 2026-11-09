import { expect, test } from 'bun:test';

import { parseEditions, serializeEditions, updateEditor } from '@opsydyn/foldkit-zloz';

import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { update } from '../src/editor/update';

test('named capture and example editions preserve earlier captures and canonical archives', () => {
  const named = update(
    init().model,
    Message.ChangedEditionName({ name: 'My working model' }),
  ).model;
  const captured = update(named, Message.ClickedCaptureEdition()).model;
  expect(captured.editions[0]?.name).toBe('My working model');
  expect(captured.editor).toBe(named.editor);
  const examples = update(captured, Message.ClickedOrderHistory()).model;
  expect(examples.editions).toHaveLength(3);
  expect(update(examples, Message.ClickedOrderHistory()).model.editions).toHaveLength(3);
  expect(parseEditions(serializeEditions(examples.editions))).toEqual(examples.editions);
});
test('rewind and navigation reject workbench mutations and return to the exact working editor and view choice', () => {
  const initial = init().model;
  const editor = updateEditor(initial.editor, {
    type: 'NodeLabelChanged',
    id: 'source',
    label: 'Working draft',
  });
  const working = { ...initial, editor };
  const examples = update(working, Message.ClickedOrderHistory()).model;
  const historical = update(
    examples,
    Message.SelectedHistoryEdition({ id: 'order-evolved' }),
  ).model;
  expect(historical.editor).toBe(editor);
  expect(historical.historyReview?.editor.readOnly).toBe(true);
  expect(historical.historyBaselineId).toBe('order-start');
  const blocked = update(historical, Message.SelectedExample({ example: 'c4-context' })).model;
  expect(blocked.editor).toBe(editor);
  expect(
    update(blocked, Message.SucceededImport({ id: -1, json: 'invalid stale load' })).model.editor,
  ).toBe(editor);
  expect(
    update(blocked, Message.ObservedZlozInput({ message: { type: 'DeletePressed' } })).model.editor,
  ).toBe(editor);
  const moved = update(
    blocked,
    Message.ObservedZlozInput({ message: { type: 'ViewportNudged', delta: { x: 20, y: 0 } } }),
  ).model;
  expect(moved.historyReview?.editor.viewport).not.toEqual(
    historical.historyReview?.editor.viewport,
  );
  const present = update(moved, Message.ClickedHistoryPresent()).model;
  expect(present.editor).toBe(editor);
  expect(present.nodeDesign).toBe(working.nodeDesign);
  expect(present.editor.past).toHaveLength(1);
});

test('returning after a resize refreshes only surface measurement, preserving document, camera and Undo', () => {
  const examples = update(init().model, Message.ClickedOrderHistory()).model;
  const reviewing = update(examples, Message.SelectedHistoryEdition({ id: 'order-evolved' })).model;
  const resized = update(
    reviewing,
    Message.ObservedZlozInput({
      message: { type: 'SurfaceMeasured', size: { width: 390, height: 700 } },
    }),
  ).model;
  const swapped = update(resized, Message.SelectedHistoryEdition({ id: 'order-start' })).model;
  expect(swapped.historyReview?.editor.surface).toEqual({ width: 390, height: 700 });
  const present = update(swapped, Message.ClickedHistoryPresent()).model;
  expect(present.editor.surface).toEqual({ width: 390, height: 700 });
  expect(present.editor.graph).toBe(examples.editor.graph);
  expect(present.editor.viewport).toBe(examples.editor.viewport);
  expect(present.editor.past).toBe(examples.editor.past);
});
