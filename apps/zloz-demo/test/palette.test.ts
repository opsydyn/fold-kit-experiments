import { expect, test } from 'vitest';

import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { workbenchPlacement } from '../src/editor/palette';
import { update } from '../src/editor/update';

test('workbench publishes editor and placement together, keeps protection live and rejects another model incarnation', () => {
  const initial = init().model;
  const start = { ...initial, editor: { ...initial.editor, surface: { width: 900, height: 600 } } };
  const token = workbenchPlacement(start);
  const active = update(
    start,
    Message.ObservedPlacementInput({
      input: {
        type: 'PaletteEntryActivated',
        scope: token.scope,
        generation: token.generation,
        id: 'c4-person',
      },
    }),
  ).model;
  expect(active.editor).toBe(start.editor);
  const controls = workbenchPlacement(active);
  const accepted = {
    type: 'PlacementAccepted',
    scope: controls.scope,
    generation: controls.generation,
    targetRevision: controls.targetRevision,
  } as const;
  const protectedModel = update(active, Message.ClickedPatternInsertionProtection()).model;
  const denied = update(protectedModel, Message.ObservedPlacementInput({ input: accepted })).model;
  expect(denied.editor).toBe(start.editor);
  expect(denied.notice).toContain('protected');
  const applied = update(active, Message.ObservedPlacementInput({ input: accepted })).model;
  expect(applied.placement.type).toBe('idle');
  expect(applied.editor.past).toHaveLength(1);
  const undone = update(
    applied,
    Message.ObservedZlozInput({ message: { type: 'UndoPressed' } }),
  ).model;
  expect(undone.editor.graph).toEqual(start.editor.graph);
  const switched = { ...active, modelEpoch: active.modelEpoch + 1 };
  expect(update(switched, Message.ObservedPlacementInput({ input: accepted })).model.editor).toBe(
    start.editor,
  );
});
