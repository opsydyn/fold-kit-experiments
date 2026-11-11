import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  zlozDddRelationshipControls,
  zlozDddRelationshipPatternSelect,
  zlozDddUpstreamRole,
  type ZlozDddRelationshipControlsViewOptions,
} from '../src/foldkit';
import {
  createEditor,
  createContextMapPattern,
  dddRelationshipPolicy,
  resolveDddRelationshipControls,
  type ZlozDddRelationshipRequest,
} from '../src/index';
async function render(
  options: ZlozDddRelationshipControlsViewOptions<ZlozDddRelationshipRequest> = {},
  protect = false,
) {
  const state = createEditor(createContextMapPattern());
  const policy = protect
    ? dddRelationshipPolicy({}, { canChangeEdgeArchitecture: () => 'Managed agreement' })
    : dddRelationshipPolicy();
  const context = resolveDddRelationshipControls(state, 'orders-billing', { policy });
  const output = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: context }),
        view: (model, h: HtmlBuilder<ZlozDddRelationshipRequest>) => ({
          title: 'DDD controls',
          body: zlozDddRelationshipControls(h, model, (r) => r, options),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = output.html;
  return window.document;
}
test('native controls expose chosen pattern/side roles and protection reasons without losing stored values', async () => {
  const dom = await render();
  expect(
    dom
      .querySelector('select[aria-label="DDD relationship pattern"] option[selected]')
      ?.getAttribute('value'),
  ).toBe('strategic:upstream-downstream');
  expect(dom.querySelector('input[aria-label="Open host service"]')?.hasAttribute('checked')).toBe(
    true,
  );
  expect(
    dom
      .querySelector('select[aria-label="Downstream role"] option[selected]')
      ?.getAttribute('value'),
  ).toBe('anti-corruption-layer');
  const protectedView = await render({}, true);
  for (const control of protectedView.querySelectorAll('select,input')) {
    expect(control.hasAttribute('disabled')).toBe(true);
    expect(control.getAttribute('aria-description')).toBe('Managed agreement');
  }
  expect(
    protectedView.querySelector('[aria-label="DDD relationship availability"]')?.textContent,
  ).toContain('Managed agreement');
});
test('custom wrappers, independently omitted parts and layout use protected native primitives', async () => {
  const dom = await render(
    {
      renderPattern: (context, h, onRequest) =>
        h.div(
          [],
          [
            h.strong([], ['Pattern contract']),
            zlozDddRelationshipPatternSelect(h, context, onRequest),
          ],
        ),
      renderUpstream: (control, context, h, onRequest) =>
        h.label(
          [],
          [zlozDddUpstreamRole(h, context, control, onRequest), `Custom ${control.label}`],
        ),
      renderDownstream: () => null,
      renderStatus: () => null,
      renderReasons: () => null,
      renderLayout: (parts, _context, h) => [
        h.div([], parts.pattern ? [parts.pattern] : []),
        ...parts.upstream,
      ],
    },
    true,
  );
  expect(dom.querySelector('strong')?.textContent).toBe('Pattern contract');
  expect(dom.querySelectorAll('select')).toHaveLength(1);
  expect(dom.querySelectorAll('input')).toHaveLength(2);
  expect(dom.querySelector('[role="status"]')).toBeNull();
  expect(dom.querySelector('input')?.hasAttribute('disabled')).toBe(true);
});
