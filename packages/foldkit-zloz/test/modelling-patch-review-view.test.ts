import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { zlozModellingPatchReview } from '../src/foldkit';
import {
  createEditor,
  captureModellingPatch,
  resolveModellingPatchReview,
  type ZlozModellingPatchReviewRequest,
} from '../src/index';
import wire from './fixtures/modelling-patch-v1.json';
async function render(custom: boolean) {
  const patch = captureModellingPatch(wire),
    editor = { ...createEditor(patch.source.graph), revision: 7 };
  const review = resolveModellingPatchReview(editor, patch.source, patch, {
    consent: null,
    blockedReason: 'Workspace protected',
  });
  assert(review.key);
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: review }),
        view: (model, h: HtmlBuilder<ZlozModellingPatchReviewRequest>) => ({
          title: 'Patch',
          body: zlozModellingPatchReview(
            h,
            model,
            (r) => r,
            custom
              ? {
                  showCounts: false,
                  instructions: false,
                  renderSummary: () => null,
                  renderChange: (c, b) => b.strong([], [`Custom ${c.id}`]),
                }
              : {},
          ),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
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
  expect(custom.body.textContent).toContain('Custom orders');
  expect(custom.querySelector('[aria-label="Patch findings"]')?.textContent).toContain(
    'authored-data-loss',
  );
});
