import { expect, test } from 'bun:test';

import { Window } from 'happy-dom';

import type { GraphSurfaceOptions } from '../src/effect-ui';
import { createEditor, parseGraph, updateEditor } from '../src/index';
import fixture from './fixtures/waypoints-v1.json';
import { renderCanvas } from './render-effect-ui';

const selected = updateEditor(createEditor(parseGraph(JSON.stringify(fixture))), {
  type: 'EdgeSelected',
  id: 'e',
  additive: false,
});
async function render(options: Partial<GraphSurfaceOptions<string>> = {}) {
  const output = await renderCanvas(selected, {
    edgeWaypoints: { onEdit: ({ type }) => type },
    edgeEditing: { onEdit: ({ type }) => type },
    ...options,
  });
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
    policy: { canChangeEdgeWaypoints: () => 'Protected by team policy' },
    edgeWaypoints: { onEdit: ({ type }) => type, measurements: false },
  });
  expect(protectedView.querySelector('[data-flow-waypoint]')?.hasAttribute('disabled')).toBe(true);
  expect(protectedView.body.textContent).toContain('Protected by team policy');
  expect(protectedView.querySelector('[data-flow-waypoint-readout]')).toBeNull();
});

test('diagnostics are independent of handles, and complete custom/null/off rendering is supported', async () => {
  const withoutMeasurements = await render({
    edgeWaypoints: { onEdit: ({ type }) => type, measurements: false },
  });
  expect(withoutMeasurements.querySelector('[data-flow-waypoint-readout]')).toBeNull();
  expect(withoutMeasurements.querySelectorAll('[data-flow-waypoint]')).toHaveLength(1);
  expect(
    (await render({ edgeWaypoints: undefined })).querySelector('[data-flow-waypoint-controls]'),
  ).toBeNull();
  expect(
    (
      await render({ edgeWaypoints: { onEdit: ({ type }) => type, render: () => null } })
    ).querySelector('[data-flow-waypoint-controls]'),
  ).toBeNull();
  const custom = await render({
    edgeWaypoints: {
      onEdit: ({ type }) => type,
      presentation: { className: 'custom-bends', marker: '◆', heading: 'Custom bends' },
    },
  });
  expect(custom.querySelector('.custom-bends [data-flow-waypoint]')?.textContent).toBe('◆');
});

test('labels clear authored handles by a configurable presentation offset without changing geometry', async () => {
  const defaults = await render();
  const badge = defaults.querySelector('button[aria-label^="Add label for"]');
  expect(badge?.parentElement?.getAttribute('style')).toMatch(/top:\s*168px/);
  const aligned = await render({
    edgeWaypoints: { onEdit: ({ type }) => type, labelOffset: { x: 0, y: 0 } },
  });
  expect(
    aligned
      .querySelector('button[aria-label^="Add label for"]')
      ?.parentElement?.getAttribute('style'),
  ).toMatch(/top:\s*200px/);
});
