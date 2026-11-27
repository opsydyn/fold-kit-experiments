import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import {
  historyComparisonControls,
  historyGhostToggle,
  type ZlozHistoryComparisonControlsViewOptions,
} from '../src/effect-ui';
import { resolveHistoryComparisonControls } from '../src/index';
const context = resolveHistoryComparisonControls(
  [
    { id: 'a', name: 'Original' },
    { id: 'b', name: 'Evolved' },
  ],
  'b',
  { baselineId: 'a', ghosts: { enabled: true, nodes: false, edges: true, movements: true } },
  { ghostReasons: { edges: 'Managed layer' } },
);
async function render(options: ZlozHistoryComparisonControlsViewOptions<string> = {}) {
  const TestView = Html.component({
    name: 'HistoryTest',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) => historyComparisonControls(h, context, (request) => request.type, options),
  });
  const output = await Effect.runPromise(HtmlServer.renderToHtml(TestView, {}, { static: true }));
  const window = new Window();
  window.document.body.innerHTML = output.html;
  return window.document;
}
test('native baseline and ghost controls retain names, choices, checked state and visible protection', async () => {
  const document = await render();
  expect(document.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
    'History comparison controls',
  );
  expect(document.querySelectorAll('option')).toHaveLength(2);
  expect(document.querySelector('select')?.value).toBe('a');
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
      h.label(historyGhostToggle(h, control, onRequest), `Custom ${control.label}`),
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
