import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import {
  historyChangeNavigator,
  historyChangeButton,
  type ZlozHistoryChangeNavigatorViewOptions,
} from '../src/effect-ui';
import {
  captureEdition,
  compareEditions,
  resolveHistoryChangeNavigator,
  type ZlozNode,
} from '../src/index';
const first: ZlozNode = {
  id: 'a',
  label: 'Old service',
  position: { x: 0, y: 0 },
  size: { width: 100, height: 80 },
  ports: [],
};
const before = captureEdition({
  id: 'a',
  name: 'Original',
  snapshot: { graph: { nodes: [first], edges: [] } },
});
const after = captureEdition({
  id: 'b',
  name: 'Evolved',
  snapshot: {
    graph: { nodes: [{ ...first, label: 'New service' }], edges: [] },
  },
});
const context = resolveHistoryChangeNavigator(compareEditions(before, after), {
  focusReason: () => 'Camera protected',
});
async function render(options: ZlozHistoryChangeNavigatorViewOptions<string> = {}) {
  const TestView = Html.component({
    name: 'HistoryTest',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) =>
      historyChangeNavigator(
        h,
        context,
        { onFilter: (kind) => kind, onFocus: (request) => request.id },
        options,
      ),
  });
  const output = await Effect.runPromise(HtmlServer.renderToHtml(TestView, {}, { static: true }));
  const window = new Window();
  window.document.body.innerHTML = output.html;
  return window.document;
}
test('native list/filter semantics and reasons remain visible with disabled focus', async () => {
  const document = await render();
  expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
  expect(
    document.querySelector('input[aria-label="Changed changes"]')?.hasAttribute('checked'),
  ).toBe(true);
  expect(document.querySelector('ul')?.getAttribute('aria-label')).toBe('History changes');
  const button = document.querySelector('button');
  expect(button?.getAttribute('type')).toBe('button');
  expect(button?.getAttribute('aria-label')).toBe('View changed node: New service');
  expect(button?.hasAttribute('disabled')).toBe(true);
  expect(button?.getAttribute('aria-description')).toBe('Camera protected');
  expect(document.querySelector('li')?.textContent).toContain('Camera protected');
  expect(document.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
});
test('nullable slots, ordered subsets, custom entries and layout reuse native protection', async () => {
  const document = await render({
    filters: ['changed', 'changed'],
    renderStatus: () => null,
    renderReason: () => null,
    renderEntry: (entry, h, onFocus) =>
      h.li(
        historyChangeButton(h, entry, onFocus, undefined, ['Custom badge'], {
          label: 'Inspect change',
        }),
      ),
    renderLayout: (parts, _context, h) => [...parts.filters, h.ul(parts.entries)],
  });
  expect(document.querySelectorAll('input')).toHaveLength(1);
  expect(document.querySelector('[role="status"]')).toBeNull();
  expect(document.querySelector('button')?.textContent).toBe('Custom badge');
  expect(document.querySelector('button')?.getAttribute('aria-label')).toBe('Inspect change');
  expect(document.querySelector('button')?.hasAttribute('disabled')).toBe(true);
  const empty = await render({ filters: [], renderEntry: () => null });
  expect(empty.querySelectorAll('input,li')).toHaveLength(0);
});
