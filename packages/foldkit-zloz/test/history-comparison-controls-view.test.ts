import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  zlozHistoryComparisonControls,
  zlozHistoryGhostToggle,
  type ZlozHistoryComparisonControlsViewOptions,
} from '../src/foldkit';
import { resolveHistoryComparisonControls, type ZlozHistoryComparisonRequest } from '../src/index';
const context = resolveHistoryComparisonControls(
  [
    { id: 'a', name: 'Original' },
    { id: 'b', name: 'Evolved' },
  ],
  'b',
  { baselineId: 'a', ghosts: { enabled: true, nodes: false, edges: true, movements: true } },
  { ghostReasons: { edges: 'Managed layer' } },
);
async function render(
  options: ZlozHistoryComparisonControlsViewOptions<ZlozHistoryComparisonRequest> = {},
) {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: context }),
        view: (model, h: HtmlBuilder<ZlozHistoryComparisonRequest>) => ({
          title: 'Comparison',
          body: zlozHistoryComparisonControls(h, model, (request) => request, options),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document;
}
test('native baseline and ghost controls retain names, choices, checked state and visible protection', async () => {
  const document = await render();
  expect(document.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
    'History comparison controls',
  );
  expect(document.querySelectorAll('option')).toHaveLength(2);
  expect(document.querySelector('option[value="a"]')?.textContent).toBe('Original');
  expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(4);
  expect(document.querySelector('input[aria-label="Node ghosts"]')?.hasAttribute('checked')).toBe(
    false,
  );
  const edges = document.querySelector('input[aria-label="Edge ghosts"]');
  expect(edges?.hasAttribute('disabled')).toBe(true);
  expect(edges?.getAttribute('aria-description')).toBe('Managed layer');
  expect(
    document.querySelector('[aria-label="History comparison availability"]')?.textContent,
  ).toContain('Managed layer');
  expect(document.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
});
test('slots omit/reorder parts and customize native controls without duplicating policy', async () => {
  const document = await render({
    ghosts: ['edges', 'nodes', 'edges'],
    renderBaseline: () => null,
    renderStatus: () => null,
    renderReason: () => null,
    renderGhost: (control, h, onRequest) =>
      h.label([], [zlozHistoryGhostToggle(h, control, onRequest), `Custom ${control.label}`]),
    renderLayout: (parts) => [...parts.ghosts].reverse(),
  });
  expect(document.querySelector('select')).toBeNull();
  expect(document.querySelectorAll('input')).toHaveLength(2);
  expect(document.querySelector('input')?.getAttribute('aria-label')).toBe('Node ghosts');
  expect(document.body.textContent).toContain('Custom Edge ghosts');
  expect(document.querySelector('input[aria-label="Edge ghosts"]')?.hasAttribute('disabled')).toBe(
    true,
  );
  expect(document.querySelector('[role="status"]')).toBeNull();
});

test('status and availability names can be localized without replacing default semantics', async () => {
  const document = await render({
    statusLabel: 'Comparison summary',
    reasonLabel: 'Comparison restrictions',
  });
  expect(document.querySelector('[aria-label="Comparison summary"]')?.getAttribute('role')).toBe(
    'status',
  );
  expect(document.querySelector('[aria-label="Comparison restrictions"]')?.textContent).toContain(
    'Managed layer',
  );
});
