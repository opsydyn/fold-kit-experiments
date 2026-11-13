import { expect, test } from 'bun:test';

import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { workbenchPngReview } from '../src/editor/png-review';
import { update } from '../src/editor/update';
test('workbench delegates render to a package Command, guards current source, and never edits graph or Undo', () => {
  const original = init().model,
    model = { ...original, sidebarSection: 'png' as const };
  const view = workbenchPngReview(model);
  const request = (type: string, extra = {}) =>
    Message.ObservedPngReviewInput({ request: { ...view.identity, type, ...extra } });
  expect(update(model, request('PngRenderRequested')).commands).toBeUndefined();
  const accepted = update(model, request('PngLossAcceptanceChanged', { accepted: true })).model;
  const rendering = update(accepted, request('PngRenderRequested'));
  expect(rendering.commands).toHaveLength(1);
  expect(rendering.model.editor).toBe(original.editor);
  expect(rendering.model.editor.past).toBe(original.editor.past);
  expect(workbenchPngReview(rendering.model).busy).toBe(true);
  const protectedModel = update(accepted, Message.ClickedPngProtection()).model;
  expect(update(protectedModel, request('PngRenderRequested')).commands).toBeUndefined();
  expect(
    update({ ...accepted, modelEpoch: accepted.modelEpoch + 1 }, request('PngRenderRequested'))
      .commands,
  ).toBeUndefined();
  const cancelled = update(rendering.model, request('PngRenderCancelled')).model;
  expect(workbenchPngReview(cancelled).busy).toBe(false);
});
