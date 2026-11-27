import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import {
  auditComparisonControls,
  auditFindingButton,
  type ZlozAuditComparisonViewOptions,
} from '../src/effect-ui';
import { createEventStormingPattern, resolveAuditComparisonControls } from '../src/index';

const graph = createEventStormingPattern(),
  first = graph.edges[0];
assert(first);
const document = {
  id: 'model',
  name: 'Model',
  origin: null,
  snapshot: {
    graph: {
      ...graph,
      edges: [
        { ...first, architecture: { family: 'event-storming' as const, role: 'emits' as const } },
      ],
    },
  },
  editions: [{ id: 'before', name: 'Before', snapshot: { graph } }],
};
const state = {
  baselineId: 'before',
  selectedId: null,
  filters: { introduced: true, resolved: true, persisting: true },
};
async function render(options: ZlozAuditComparisonViewOptions<string> = {}, unavailable = false) {
  const context = resolveAuditComparisonControls(
    document,
    unavailable ? { ...state, baselineId: 'missing' } : state,
    { focusReason: () => 'Protected focus' },
  );
  const Audit = Html.component({
    name: 'auditComparisonControls',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) => auditComparisonControls(h, context, (request) => request.type, options),
  });
  const result = await Effect.runPromise(HtmlServer.renderToHtml(Audit, {}, { static: true }));
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document;
}
test('native selectors preserve SSR identities including unavailable choices; finding buttons retain protection reasons', async () => {
  const dom = await render();
  expect(
    dom
      .querySelector('select[aria-label="Audit baseline"] option[selected]')
      ?.getAttribute('value'),
  ).toBe('before');
  expect(dom.querySelector('select[aria-label="Audit target"] option[selected]')?.textContent).toBe(
    'Current graph',
  );
  expect(dom.querySelector('button')?.hasAttribute('disabled')).toBe(true);
  expect(dom.querySelector('button')?.getAttribute('aria-description')).toBe('Protected focus');
  expect(dom.querySelector('li')?.textContent).toContain('Protected focus');
  const missing = await render({}, true);
  expect(missing.querySelector('option[selected]')?.textContent).toContain(
    'Unavailable edition: missing',
  );
});
test('custom badges, omitted slots, layout, ordered filters and count-free defaults compose without bypassing protection', async () => {
  const custom = await render({
    showCounts: false,
    filters: ['introduced', 'introduced'],
    renderStatus: () => null,
    renderReason: () => null,
    renderEntry: (entry, h, onRequest) =>
      h.li.children(
        auditFindingButton(h, entry, onRequest, {
          content: 'Custom badge',
          label: 'Inspect finding',
        }),
      ),
    renderLayout: (parts, _context, h) => [...parts.filters, h.ul.children(...parts.entries)],
  });
  expect(custom.querySelectorAll('input')).toHaveLength(1);
  expect(custom.querySelector('[role="status"]')).toBeNull();
  expect(custom.querySelector('button')?.textContent).toBe('Custom badge');
  expect(custom.querySelector('button')?.hasAttribute('disabled')).toBe(true);
  const plain = await render({ showCounts: false });
  expect(plain.body.textContent).not.toMatch(/\(1\)|1 introduced/);
  const omitted = await render({
    renderBaseline: () => null,
    renderTarget: () => null,
    filters: [],
    renderEntry: () => null,
  });
  expect(omitted.querySelectorAll('select,input,li')).toHaveLength(0);
});
