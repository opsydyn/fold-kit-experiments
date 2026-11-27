import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import { svgReview } from '../src/effect-ui';
import {
  createSvgReview,
  resolveSvgReview,
  updateSvgReview,
  createArchitecturePattern,
  type ZlozSvgReviewContext,
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
  const Review = Html.component({
    name: 'SvgReview',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) =>
      svgReview(h, controls, (request) => request.type, {
        idPrefix: 'zloz-svg-review',
        diagnostics: { instructions: !minimal, measurements: !minimal },
        download: custom ? { className: 'custom-svg-download', label: 'Save vector' } : undefined,
      }),
  });
  const output = await Effect.runPromise(HtmlServer.renderToHtml(Review, {}, { static: true }));
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
test('SVG choice names remain separate from option text and bind their controls', async () => {
  const document = await render();
  for (const [field, name] of [
    ['regionId', 'SVG region'],
    ['themeId', 'SVG theme'],
    ['backgroundId', 'SVG background'],
  ] as const) {
    const label = document.querySelector(`label[for="zloz-svg-review-${field}"]`);
    expect(label?.textContent).toBe(name);
    expect(document.getElementById(`zloz-svg-review-${field}`)?.tagName).toBe('SELECT');
  }
});
