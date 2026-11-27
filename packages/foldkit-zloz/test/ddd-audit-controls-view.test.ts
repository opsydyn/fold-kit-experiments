import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import {
  dddAuditControls,
  dddAuditFindingButton,
  type ZlozDddAuditViewOptions,
} from '../src/effect-ui';
import { parseModelDocument, resolveDddAuditControls } from '../src/index';
import wire from './fixtures/ddd-review-model.json';
async function render(
  options: ZlozDddAuditViewOptions<string> = {},
  baselineId: string | null = 'ddd-before',
) {
  const context = resolveDddAuditControls(
    parseModelDocument(JSON.stringify(wire)),
    {
      baselineId,
      selectedId: 'ddd-after',
      filters: { introduced: true, resolved: true, persisting: true },
    },
    { focusReason: () => 'Protected navigation' },
  );
  const Audit = Html.component({
    name: 'dddAuditControls',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) => dddAuditControls(h, context, (request) => request.type, options),
  });
  const result = await Effect.runPromise(HtmlServer.renderToHtml(Audit, {}, { static: true }));
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document;
}
test('DDD native review exposes selected sources, convention reasons and protected edge/source/target buttons', async () => {
  const dom = await render();
  expect(dom.querySelectorAll('li')).toHaveLength(6);
  expect(dom.querySelectorAll('li button')).toHaveLength(18);
  expect(
    dom.querySelector('select[aria-label="DDD baseline"] option[selected]')?.getAttribute('value'),
  ).toBe('ddd-before');
  expect(
    dom.querySelector('select[aria-label="DDD target"] option[selected]')?.getAttribute('value'),
  ).toBe('ddd-after');
  expect(dom.querySelectorAll('button[disabled]')).toHaveLength(18);
  expect(dom.querySelector('button')?.getAttribute('aria-description')).toBe(
    'Protected navigation',
  );
  expect(dom.querySelector('li')?.textContent).toContain('tactical:custom:enriches');
  expect(dom.querySelector('[role="status"]')?.textContent).toBe(
    '2 introduced, 3 resolved, 1 persisting.',
  );
  const missing = await render({}, 'missing');
  expect(missing.querySelector('option[selected]')?.textContent).toContain(
    'Unavailable edition: missing',
  );
});
test('DDD current review and minimal/custom/omitted compositions preserve native semantics and protection', async () => {
  const single = await render({ showCounts: false }, null);
  expect(single.querySelectorAll('input')).toHaveLength(0);
  expect(single.querySelectorAll('li')).toHaveLength(3);
  expect(single.querySelector('[role="status"]')?.textContent).toBe(
    'Blocked DDD findings available.',
  );
  const minimal = await render({ showCounts: false });
  expect(minimal.body.textContent).not.toMatch(/\(2\)|2 introduced/);
  const custom = await render({
    showCounts: false,
    filters: ['resolved', 'resolved'],
    renderStatus: () => null,
    renderReason: () => null,
    renderEntry: (e, h, r) =>
      h.li.children(dddAuditFindingButton(h, e, r, { content: 'Custom finding' })),
    renderLayout: (parts, _context, h) => [...parts.filters, h.ul.children(...parts.entries)],
  });
  expect(custom.querySelectorAll('input')).toHaveLength(1);
  expect(custom.querySelector('[role="status"]')).toBeNull();
  expect(custom.querySelector('button')?.textContent).toBe('Custom finding');
  expect(custom.querySelector('button')?.hasAttribute('disabled')).toBe(true);
  const omitted = await render({
    renderBaseline: () => null,
    renderTarget: () => null,
    filters: [],
    renderEntry: () => null,
  });
  expect(omitted.querySelectorAll('select,input,li')).toHaveLength(0);
});
