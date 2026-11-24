import type { EditorEvent, ZlozGraph } from '@opsydyn/foldkit-zloz';
import fc from 'fast-check';
import { expect, test } from 'vitest';

import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { update } from '../src/editor/update';

const input = (message: EditorEvent) => Message.ObservedZlozInput({ message });
const edition = fc.constantFrom('order-start', 'order-evolved');
const draftEdit = fc.record({
  kind: fc.constantFrom('rename', 'widen'),
  id: fc.constantFrom('source', 'review', 'publish'),
});
const reviewAction = fc.oneof(
  edition.map((id) => Message.SelectedHistoryEdition({ id })),
  fc
    .integer({ min: -80, max: 80 })
    .map((x) => input({ type: 'ViewportNudged', delta: { x, y: 0 } })),
  fc
    .record({
      width: fc.integer({ min: 320, max: 1440 }),
      height: fc.integer({ min: 240, max: 900 }),
    })
    .map((size) => input({ type: 'SurfaceMeasured', size })),
  fc.constantFrom(
    input({ type: 'UndoPressed' }),
    input({ type: 'RedoPressed' }),
    input({ type: 'NodeLabelChanged', id: 'source', label: 'Edited during review' }),
  ),
);
const historyVisit = fc.record({
  edits: fc.array(draftEdit, { minLength: 1, maxLength: 4 }),
  edition,
  actions: fc.array(reviewAction, { maxLength: 8 }),
});

test('returning from history preserves the working draft and each undo step across review visits', () => {
  fc.assert(
    fc.property(fc.array(historyVisit, { minLength: 1, maxLength: 3 }), (visits) => {
      let model = update(init().model, Message.ClickedOrderHistory()).model;
      const beforeEdits: ZlozGraph[] = [];

      for (const visit of visits) {
        for (const { kind, id } of visit.edits) {
          const before = structuredClone(model.editor.graph);
          beforeEdits.push(before);
          const edit =
            kind === 'rename'
              ? input({ type: 'NodeLabelChanged', id, label: `Draft edit ${beforeEdits.length}` })
              : input({ type: 'NodeResizeNudged', id, delta: 32 });
          model = update(model, edit).model;
          expect(model.editor.graph).not.toEqual(before);
        }

        const draft = structuredClone(model.editor.graph);
        model = update(model, Message.SelectedHistoryEdition({ id: visit.edition })).model;
        expect(model.historyReview?.editionId).toBe(visit.edition);
        for (const action of visit.actions) {
          model = update(model, action).model;
          if (action._tag === 'SelectedHistoryEdition') {
            expect(model.historyReview?.editionId).toBe(action.id);
          }
        }
        expect(model.historyReview).not.toBeNull();

        model = update(model, Message.ClickedHistoryPresent()).model;
        expect(model.historyReview).toBeNull();
        expect(model.editor.graph).toEqual(draft);

        // Undo on a separate branch so the next visit continues with the working draft.
        let undo = model;
        expect(undo.editor.past).toHaveLength(beforeEdits.length);
        for (const expected of beforeEdits.toReversed()) {
          undo = update(undo, input({ type: 'UndoPressed' })).model;
          expect(undo.editor.graph).toEqual(expected);
        }
      }
    }),
    { numRuns: 100 },
  );
});
