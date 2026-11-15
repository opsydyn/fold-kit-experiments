import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { zlozView, zlozEdgeWaypointHandle, type ZlozViewOptions } from '../src/foldkit';
import { createEditor, parseGraph, updateEditor, type EditorEvent } from '../src/index';
import fixture from './fixtures/waypoints-v1.json';

const selected = updateEditor(createEditor(parseGraph(JSON.stringify(fixture))), {
  type: 'EdgeSelected',
  id: 'e',
  additive: false,
});
async function render(options: Partial<ZlozViewOptions<EditorEvent>> = {}) {
  const output = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: selected }),
        view: (state, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Bends',
          body: zlozView(h, state, {
            id: 'bends',
            label: 'Bends',
            onEvent: (event) => event,
            edgeWaypoints: true,
            ...options,
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

test('native controls expose stable delegated metadata, measurements and actual protection reasons', async () => {
  const document = await render();
  const handle = document.querySelector('[data-flow-waypoint="bend"]');
  expect(handle?.tagName).toBe('BUTTON');
  expect(handle?.getAttribute('data-flow-waypoint-edge')).toBe('e');
  expect(handle?.getAttribute('data-flow-waypoint-revision')).toBe('0');
  expect(handle?.getAttribute('aria-label')).toBe('Move bend 1');
  expect(document.querySelector('[data-flow-waypoint-readout]')?.textContent).toBe('200, 200');
  const protectedView = await render({
    canChangeEdgeWaypoints: () => 'Protected by team policy',
    minimalMode: true,
  });
  expect(protectedView.querySelector('[data-flow-waypoint]')?.hasAttribute('disabled')).toBe(true);
  expect(protectedView.body.textContent).toContain('Protected by team policy');
  expect(protectedView.querySelector('[data-flow-waypoint-readout]')).toBeNull();
});

test('diagnostics are independent of handles, and complete custom/null/off rendering is supported', async () => {
  for (const options of [
    { minimalMode: true },
    { diagnostics: false },
    { diagnostics: { measurements: false } },
  ]) {
    const document = await render(options);
    expect(document.querySelector('[data-flow-waypoint-readout]')).toBeNull();
    expect(document.querySelectorAll('[data-flow-waypoint]')).toHaveLength(1);
  }
  expect(
    (await render({ edgeWaypoints: false })).querySelector('[data-flow-waypoint-controls]'),
  ).toBeNull();
  expect(
    (await render({ renderEdgeWaypoints: () => null })).querySelector(
      '[data-flow-waypoint-controls]',
    ),
  ).toBeNull();
  const custom = await render({
    renderEdgeWaypoints: (context, h) =>
      h.div(
        [h.DataAttribute('custom-bends', '')],
        context.handles.map((handle) =>
          zlozEdgeWaypointHandle(h, handle, [h.Class('diamond')], ['◆']),
        ),
      ),
  });
  expect(custom.querySelector('[data-custom-bends] [data-flow-waypoint]')?.className).toBe(
    'diamond',
  );
});

test('labels clear authored handles by a configurable presentation offset without changing geometry', async () => {
  const defaults = await render();
  const badge = defaults.querySelector('button[aria-label^="Add label for"]');
  expect(badge?.parentElement?.getAttribute('style')).toMatch(/top:\s*168px/);
  const aligned = await render({ waypointLabelOffset: { x: 0, y: 0 } });
  expect(
    aligned
      .querySelector('button[aria-label^="Add label for"]')
      ?.parentElement?.getAttribute('style'),
  ).toMatch(/top:\s*200px/);
});
