import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { zlozSvgReview, zlozSvgDownloadButton } from '../src/foldkit';
import {
  createSvgReview,
  resolveSvgReview,
  updateSvgReview,
  createArchitecturePattern,
  type ZlozSvgReviewContext,
  type ZlozSvgReviewRequest,
} from '../src/index';
const graph = createArchitecturePattern('c4-context');
const first = graph.nodes[0];
assert(first);
const context: ZlozSvgReviewContext = {
  scope: 'review',
  sourceRevision: 0,
  snapshot: { graph, viewport: { x: 0, y: 0, zoom: 1 } },
  surface: { width: 800, height: 600 },
  title: 'Review',
  theme: { colorScheme: 'light' },
  renderers: {
    nodes: 'built-in',
    edges: 'built-in',
    overrides: [
      {
        target: { kind: 'node', id: first.id },
        renderer: { type: 'omit', reason: 'Interactive artwork omitted' },
      },
    ],
  },
};
async function render(minimal = false, custom = false, accepted = false) {
  let state = createSvgReview(context.scope);
  if (accepted) {
    const controls = resolveSvgReview(state, context);
    state = updateSvgReview(state, context, {
      ...controls.identity,
      type: 'SvgLossAcceptanceChanged',
      accepted: true,
    }).state;
  }
  const controls = resolveSvgReview(state, context);
  const output = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: controls }),
        view: (model, h: HtmlBuilder<ZlozSvgReviewRequest>) => ({
          title: 'SVG review',
          body: zlozSvgReview(h, model, (request) => request, {
            diagnostics: { instructions: !minimal, measurements: !minimal },
            renderDownload: custom
              ? (ctx, builder, onRequest) =>
                  zlozSvgDownloadButton(
                    builder,
                    ctx,
                    onRequest,
                    [builder.Class('custom-svg-download')],
                    ['Save vector'],
                  )
              : undefined,
          }),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = output.html;
  return window.document;
}
test('native controls label choices, show losses and preview, and require explicit acceptance', async () => {
  const document = await render();
  expect(document.querySelectorAll('select')).toHaveLength(3);
  expect(document.querySelector('label[for="zloz-svg-review-regionId"]')?.textContent).toContain(
    'SVG region',
  );
  expect(document.querySelector('[data-zloz-svg-loss-acceptance]')?.hasAttribute('checked')).toBe(
    false,
  );
  expect(document.querySelector('[data-zloz-svg-download]')?.hasAttribute('disabled')).toBe(true);
  expect(document.querySelector('ul[aria-label="SVG findings"]')?.textContent).toContain(
    'Interactive artwork omitted',
  );
  expect(document.querySelector('img')?.getAttribute('src')).toStartWith('data:image/svg+xml');
  expect(document.querySelector('img')?.getAttribute('alt')).toBe('SVG export preview');
  const accepted = await render(false, false, true);
  expect(accepted.querySelector('[data-zloz-svg-download]')?.hasAttribute('disabled')).toBe(false);
});
test('minimal/custom presentation keeps findings, acceptance and download semantics while omitting readouts', async () => {
  const document = await render(true, true, true);
  expect(document.querySelector('.custom-svg-download')?.textContent).toBe('Save vector');
  expect(document.querySelector('.custom-svg-download')?.hasAttribute('disabled')).toBe(false);
  expect(document.querySelector('[data-zloz-svg-readout]')).toBeNull();
  expect(document.body.textContent).toContain('Interactive artwork omitted');
  expect(document.querySelector('[data-zloz-svg-loss-acceptance]')?.hasAttribute('checked')).toBe(
    true,
  );
  expect(document.body.textContent).not.toContain('Loss acceptance applies only');
});
