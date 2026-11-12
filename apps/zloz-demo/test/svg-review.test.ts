import { expect, test } from 'bun:test';

import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { workbenchSvgReview } from '../src/editor/svg-review';
import { update } from '../src/editor/update';

test('workbench uses package acceptance and publishes a captured download Command without changing graph or Undo', () => {
  const model = { ...init().model, nodeDesign: 'orbits' as const };
  const review = workbenchSvgReview(model);
  expect(review.hasLosses).toBe(true);
  expect(
    update(
      model,
      Message.ObservedSvgReviewInput({
        request: { ...review.identity, type: 'SvgDownloadRequested' },
      }),
    ).commands,
  ).toBeUndefined();
  const accepted = update(
    model,
    Message.ObservedSvgReviewInput({
      request: { ...review.identity, type: 'SvgLossAcceptanceChanged', accepted: true },
    }),
  ).model;
  const downloaded = update(
    accepted,
    Message.ObservedSvgReviewInput({
      request: { ...review.identity, type: 'SvgDownloadRequested' },
    }),
  );
  expect(downloaded.commands).toHaveLength(1);
  expect(downloaded.model.editor).toBe(model.editor);
  expect(downloaded.model.editor.past).toBe(model.editor.past);
  const protectedModel = update(accepted, Message.ClickedSvgDownloadProtection()).model;
  expect(
    update(
      protectedModel,
      Message.ObservedSvgReviewInput({
        request: { ...review.identity, type: 'SvgDownloadRequested' },
      }),
    ).commands,
  ).toBeUndefined();
  const changed = { ...accepted, modelEpoch: accepted.modelEpoch + 1 };
  expect(
    update(
      changed,
      Message.ObservedSvgReviewInput({
        request: { ...review.identity, type: 'SvgDownloadRequested' },
      }),
    ).commands,
  ).toBeUndefined();
});
