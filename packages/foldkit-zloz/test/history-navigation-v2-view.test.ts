import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import { compareEditionsV2, parseModelDocumentV2, resolveHistoryChangeNavigatorV2 } from '../src';
import {
  historyChangeNavigatorV2,
  historyChangeButtonV2,
  type ZlozHistoryChangeNavigatorViewOptionsV2,
} from '../src/effect-ui';
import wire from './fixtures/model-v2-modes.json';

const before = parseModelDocumentV2(JSON.stringify(wire)).editions[0]!;
const after = {
  ...before,
  id: 'next',
  snapshot: {
    ...before.snapshot,
    connectionMode: 'strict' as const,
    graph: { nodes: [], edges: [] },
  },
};
const comparison = compareEditionsV2(before, after);
const context = resolveHistoryChangeNavigatorV2(comparison, 'selected');
async function render(options: ZlozHistoryChangeNavigatorViewOptionsV2<string> = {}) {
  const TestView = Html.component({
    name: 'HistoryTest',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) =>
      historyChangeNavigatorV2(
        h,
        context,
        { onFilter: (kind) => kind, onFocus: (request) => request.entity },
        options,
      ),
  });
  const output = await Effect.runPromise(HtmlServer.renderToHtml(TestView, {}, { static: true }));
  const window = new Window();
  window.document.body.innerHTML = output.html;
  return window.document;
}

test('native mode navigation and side-absent entries have readable names, visible reasons and disabled buttons', async () => {
  const document = await render();
  expect(document.querySelectorAll('input[type=checkbox]')).toHaveLength(3);
  const mode = document.querySelector('[data-zloz-history-change-v2="mode"]');
  expect(mode?.getAttribute('aria-label')).toBe(
    'View Connection mode changed from loose to strict.',
  );
  expect(mode?.hasAttribute('disabled')).toBe(false);
  const absent = document.querySelector('[data-zloz-history-change-v2="node"]');
  expect(absent?.hasAttribute('disabled')).toBe(true);
  expect(absent?.getAttribute('aria-description')).toContain('absent from the selected edition');
  expect(document.body.textContent).toContain('absent from the selected edition');
  expect(document.querySelector('[role=status]')?.getAttribute('aria-live')).toBe('polite');
});

test('entry, filter, status, reason and layout hooks support replacement, default and omission', async () => {
  const custom = await render({
    filters: ['changed'],
    label: 'Custom changes',
    renderEntry: (entry, h, onFocus) =>
      h.li(historyChangeButtonV2(h, entry, onFocus, undefined, [`Badge ${entry.label}`])),
    renderFilter: () => null,
    renderStatus: () => null,
    renderReason: () => null,
    renderLayout: (parts) => parts.entries,
  });
  expect(custom.querySelectorAll('input, [role=status]')).toHaveLength(0);
  expect(custom.body.textContent).toContain('Badge Connection mode');
  expect(custom.querySelector('[role=group]')?.getAttribute('aria-label')).toBe('Custom changes');
  const omitted = await render({ renderEntry: () => null, renderFilter: () => undefined });
  expect(omitted.querySelectorAll('button')).toHaveLength(0);
  expect(omitted.querySelectorAll('input')).toHaveLength(3);
});
