import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  zlozHistoryChangeNavigator,
  zlozHistoryChangeButton,
  type ZlozHistoryChangeNavigatorViewOptions,
} from '../src/foldkit';
import {
  captureEdition,
  compareEditions,
  resolveHistoryChangeNavigator,
  type ZlozHistoryChangeFocusRequest,
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
type Message = ZlozHistoryChangeFocusRequest | string;
async function render(options: ZlozHistoryChangeNavigatorViewOptions<Message> = {}) {
  const output = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: context }),
        view: (model, h: HtmlBuilder<Message>) => ({
          title: 'Changes',
          body: zlozHistoryChangeNavigator(
            h,
            model,
            { onFilter: (kind) => kind, onFocus: (request) => request },
            options,
          ),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
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
        [],
        [
          zlozHistoryChangeButton(h, entry, onFocus, [], ['Custom badge'], {
            label: 'Inspect change',
          }),
        ],
      ),
    renderLayout: (parts, _context, h) => [...parts.filters, h.ul([], parts.entries)],
  });
  expect(document.querySelectorAll('input')).toHaveLength(1);
  expect(document.querySelector('[role="status"]')).toBeNull();
  expect(document.querySelector('button')?.textContent).toBe('Custom badge');
  expect(document.querySelector('button')?.getAttribute('aria-label')).toBe('Inspect change');
  expect(document.querySelector('button')?.hasAttribute('disabled')).toBe(true);
  const empty = await render({ filters: [], renderEntry: () => null });
  expect(empty.querySelectorAll('input,li')).toHaveLength(0);
});
