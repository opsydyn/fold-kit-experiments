import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { zlozPngReview, zlozPngAction } from '../src/foldkit';
import { createPngReview, resolvePngReview, type ZlozPngReviewRequest } from '../src/index';
async function render(minimal = false, custom = false) {
  const controls = resolvePngReview(createPngReview('view'), {
    scope: 'view',
    sourceRevision: 0,
    snapshot: { graph: { nodes: [], edges: [] }, viewport: { x: 0, y: 0, zoom: 1 } },
    title: 'PNG',
    theme: { colorScheme: 'light' },
    renderers: { nodes: 'built-in', edges: 'built-in' },
  });
  const output = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: controls }),
        view: (model, h: HtmlBuilder<ZlozPngReviewRequest>) => ({
          title: 'PNG',
          body: zlozPngReview(h, model, (r) => r, {
            diagnostics: { instructions: !minimal, measurements: !minimal },
            renderDownload: custom
              ? (ctx, builder, onRequest) =>
                  zlozPngAction(
                    builder,
                    ctx,
                    'download',
                    onRequest,
                    [builder.Class('custom-save')],
                    ['Save pixels'],
                  )
              : undefined,
            renderPreview: custom ? () => null : undefined,
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
