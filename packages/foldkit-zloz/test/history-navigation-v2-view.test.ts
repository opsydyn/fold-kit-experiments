import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  compareEditionsV2,
  parseModelDocumentV2,
  resolveHistoryChangeNavigatorV2,
  type ZlozHistoryChangeFocusRequestV2,
} from '../src';
import {
  zlozHistoryChangeNavigatorV2,
  zlozHistoryChangeButtonV2,
  type ZlozHistoryChangeNavigatorViewOptionsV2,
} from '../src/foldkit';
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
async function render(
  options: ZlozHistoryChangeNavigatorViewOptionsV2<ZlozHistoryChangeFocusRequestV2> = {},
) {
  const output = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: context }),
        view: (model, h: HtmlBuilder<ZlozHistoryChangeFocusRequestV2>) => ({
          title: 'Navigator v2',
          body: zlozHistoryChangeNavigatorV2(
            h,
            model,
            {
              onFocus: (request) => request,
              onFilter: (): ZlozHistoryChangeFocusRequestV2 => ({
                baselineId: before.id,
                selectedId: after.id,
                entity: 'mode',
              }),
            },
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
      h.li([], [zlozHistoryChangeButtonV2(h, entry, onFocus, [], [`Badge ${entry.label}`])]),
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
