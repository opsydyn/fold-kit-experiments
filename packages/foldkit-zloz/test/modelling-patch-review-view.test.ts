import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import { modellingPatchReview } from '../src/effect-ui';
import { createEditor, captureModellingPatch, resolveModellingPatchReview } from '../src/index';
import wire from './fixtures/modelling-patch-v1.json';
async function render(custom: boolean) {
  const patch = captureModellingPatch(wire),
    editor = { ...createEditor(patch.source.graph), revision: 7 };
  const review = resolveModellingPatchReview(editor, patch.source, patch, {
    consent: null,
    blockedReason: 'Workspace protected',
  });
  assert(review.key);
  const Review = Html.component({
    name: 'PatchReview',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) =>
      modellingPatchReview(
        h,
        review,
        (request) => request.type,
        custom
          ? {
              showCounts: false,
              instructions: false,
              renderSummary: () => null,
              renderChange: (change, h) => h.strong(`Custom ${change.id}`),
              renderLayout: ({ findings, status, changes, acknowledgement, apply }, h) =>
                h.section
                  .attr('data-custom-review', '')
                  .children(findings, status, changes, acknowledgement, apply),
            }
          : {},
      ),
  });
  const result = await Effect.runPromise(HtmlServer.renderToHtml(Review, {}, { static: true }));
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document;
}
test('native and customized readouts retain protection, findings and explicit acknowledgement', async () => {
  const native = await render(false);
  expect(native.body.textContent).toContain('Workspace protected');
  expect(native.querySelector('input')?.hasAttribute('disabled')).toBe(true);
  expect(native.querySelector('button')?.hasAttribute('disabled')).toBe(true);
  expect(native.body.textContent).toContain('accept the disclosed losses');
  const custom = await render(true);
  expect(custom.querySelector('[data-patch-counts]')).toBeNull();
  expect(custom.querySelector('[data-custom-review] input')?.hasAttribute('disabled')).toBe(true);
  expect(custom.querySelector('summary')).toBeNull();
  expect(custom.body.textContent).toContain('Custom orders');
  expect(custom.querySelector('[aria-label="Patch findings"]')?.textContent).toContain(
    'authored-data-loss',
  );
});
