import { expect, test } from 'vitest';

import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { workbenchSvgReview, workbenchSvgContext } from '../src/editor/svg-review';
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

test('retained SVG opt-in changes review identity without changing source, Undo or PNG', () => {
  const model = init().model;
  const empty = update(model, Message.ClickedRetainedSvgLayout()).model;
  expect(workbenchSvgReview(empty).downloadReason).toContain('Arrange');
  const edge = model.editor.graph.edges[0];
  if (!edge) throw new Error('Expected example edge');
  const routed = {
    ...model,
    editor: {
      ...model.editor,
      routes: [
        {
          id: edge.id,
          points: [
            { x: 0, y: 0 },
            { x: 300, y: 220 },
          ],
        },
      ],
    },
  };
  const original = workbenchSvgReview(routed);
  const enabled = update(routed, Message.ClickedRetainedSvgLayout()).model;
  const retained = workbenchSvgReview(enabled);
  expect(retained.options?.layout?.snapshot.routes).toEqual(routed.editor.routes);
  expect(retained.identity.key).not.toBe(original.identity.key);
  expect(enabled.editor).toBe(routed.editor);
  expect(enabled.editor.past).toBe(routed.editor.past);
  expect(workbenchSvgContext(enabled, 'png').layout).toBeUndefined();
  expect(update(enabled, Message.ClickedRetainedSvgLayout()).model.retainedSvgLayout).toBe(false);
});
