import { expect, test } from 'vitest';

import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { workbenchPngReview } from '../src/editor/png-review';
import { workbenchSvgReview } from '../src/editor/svg-review';
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
  const stale = update(rendering.model, request('PngRenderCancelled', { key: 'old-source' }));
  expect(stale.interrupts).toBeUndefined();
  expect(workbenchPngReview(stale.model).busy).toBe(true);
  const cancelled = update(rendering.model, request('PngRenderCancelled'));
  expect(cancelled.interrupts).toHaveLength(1);
  const issued = rendering.commands?.[0];
  expect(issued?.groupKey).toBeDefined();
  expect(cancelled.interrupts?.[0]).toMatchObject({
    _tag: 'Interrupt',
    name: 'RenderPng',
    groupKey: issued?.groupKey,
  });
  expect(workbenchPngReview(cancelled.model).busy).toBe(false);
});

test('retained PNG opt-in is independent from SVG and preserves the working editor and Undo', () => {
  const initial = { ...init().model, sidebarSection: 'png' as const };
  const missing = update(initial, Message.ClickedRetainedPngLayout()).model;
  expect(workbenchPngReview(missing).renderReason).toContain('Arrange');
  const edge = initial.editor.graph.edges[0];
  if (!edge) throw new Error('Expected sample edge');
  const model = {
    ...initial,
    editor: {
      ...initial.editor,
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
  const enabled = update(model, Message.ClickedRetainedPngLayout()).model;
  const png = workbenchPngReview(enabled);
  expect(png.svg.options?.layout?.snapshot.routes).toEqual(model.editor.routes);
  expect(workbenchSvgReview(enabled).options?.layout).toBeUndefined();
  expect(
    workbenchPngReview(update(enabled, Message.ClickedRetainedSvgLayout()).model).identity.key,
  ).toBe(png.identity.key);
  expect(enabled.editor).toBe(model.editor);
  expect(enabled.editor.past).toBe(model.editor.past);
  const accepted = update(
    enabled,
    Message.ObservedPngReviewInput({
      request: { ...png.identity, type: 'PngLossAcceptanceChanged', accepted: true },
    }),
  ).model;
  const rendering = update(
    accepted,
    Message.ObservedPngReviewInput({ request: { ...png.identity, type: 'PngRenderRequested' } }),
  ).model;
  const changed = update(rendering, Message.ClickedRetainedPngLayout()).model;
  const late = update(
    changed,
    Message.ObservedPngReviewInput({
      request: {
        ...png.identity,
        type: 'PngRenderSettled',
        run: rendering.pngReview.run,
        result: {
          type: 'rendered',
          artifact: {
            width: png.plan?.width,
            height: png.plan?.height,
            byteLength: 33,
            dataUrl: 'data:image/png;base64,iVBORw0KGgo',
          },
        },
      },
    }),
  ).model;
  expect(workbenchPngReview(late).artifact).toBeNull();
  expect(workbenchPngReview(late).accepted).toBe(false);
  expect(late.editor).toBe(model.editor);
});
