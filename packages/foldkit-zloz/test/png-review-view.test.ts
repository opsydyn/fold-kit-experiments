import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import { pngReview } from '../src/effect-ui';
import { createPngReview, resolvePngReview } from '../src/index';
async function render(minimal = false, custom = false) {
  const controls = resolvePngReview(createPngReview('view'), {
    scope: 'view',
    sourceRevision: 0,
    snapshot: { graph: { nodes: [], edges: [] }, viewport: { x: 0, y: 0, zoom: 1 } },
    title: 'PNG',
    theme: { colorScheme: 'light' },
    renderers: { nodes: 'built-in', edges: 'built-in' },
  });
  const Review = Html.component({
    name: 'PngReview',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) =>
      pngReview(h, controls, (request) => request.type, {
        idPrefix: 'zloz-png-review',
        diagnostics: { instructions: !minimal, measurements: !minimal },
        download: custom ? { className: 'custom-save', label: 'Save pixels' } : undefined,
        renderLayout: custom
          ? (parts, builder) =>
              builder.section
                .attr('data-custom-layout', '')
                .children(
                  ...parts.settings,
                  parts.status,
                  parts.findings,
                  parts.acceptance,
                  parts.render,
                  parts.download,
                )
          : undefined,
      }),
  });
  const output = await Effect.runPromise(HtmlServer.renderToHtml(Review, {}, { static: true }));
  const window = new Window();
  window.document.body.innerHTML = output.html;
  return window.document;
}
test('native PNG controls label settings, require consent and an actual render; minimal/custom slots preserve reasons', async () => {
  const document = await render();
  expect(document.querySelectorAll('select')).toHaveLength(4);
  expect(document.querySelector('label[for="zloz-png-review-scale"]')?.textContent).toContain(
    'PNG scale',
  );
  expect(document.querySelector('[data-zloz-png-action="render"]')?.hasAttribute('disabled')).toBe(
    true,
  );
  expect(
    document.querySelector('[data-zloz-png-action="download"]')?.hasAttribute('disabled'),
  ).toBe(true);
  expect(document.querySelector('img')).toBeNull();
  expect(document.querySelector('ul')?.textContent).toContain('flattens');
  const minimal = await render(true, true);
  expect(
    minimal
      .querySelector('[data-custom-layout] [data-zloz-png-action=render]')
      ?.hasAttribute('disabled'),
  ).toBe(true);
  expect(minimal.querySelector('.custom-save')?.textContent).toBe('Save pixels');
  expect(minimal.querySelector('[data-zloz-png-readout]')).toBeNull();
  expect(minimal.querySelector('ul')?.textContent).toContain('flattens');
  expect(minimal.body.textContent).not.toContain('same bytes.');
});
test('PNG field labels contain only their names and independently bind their selects', async () => {
  const document = await render();
  for (const [field, name] of [
    ['regionId', 'PNG region'],
    ['themeId', 'PNG theme'],
    ['backgroundId', 'PNG background'],
    ['scale', 'PNG scale'],
  ] as const) {
    const label = document.querySelector(`label[for="zloz-png-review-${field}"]`);
    expect(label?.textContent).toBe(name);
    expect(label?.querySelector('select')).toBeNull();
    expect(document.getElementById(`zloz-png-review-${field}`)?.tagName).toBe('SELECT');
  }
});
