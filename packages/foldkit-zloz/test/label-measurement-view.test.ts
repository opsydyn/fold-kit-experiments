import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';

import { zlozView } from '../src/foldkit';
import { createEditor, startLabelMeasurement, type EditorEvent } from '../src/index';
const state = createEditor(
  {
    nodes: [
      {
        id: 'a',
        label: 'A',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 80 },
        ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
      },
      {
        id: 'b',
        label: 'B',
        position: { x: 400, y: 0 },
        size: { width: 100, height: 80 },
        ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
      },
    ],
    edges: [
      {
        id: 'ab',
        source: { node: 'a', port: 'out' },
        target: { node: 'b', port: 'in' },
        label: 'A to B',
      },
    ],
  },
  { readOnly: true },
);
async function render(enabled: boolean, timeoutMs = 3000) {
  const measurement = startLabelMeasurement(state, 'ssr:1', 'badge:1');
  assert(measurement.type === 'pending');
  return (
    await Effect.runPromise(
      renderToString(
        {
          Flags: Schema.Struct({}),
          init: () => ({ model: state }),
          view: (editor, h: HtmlBuilder<EditorEvent>) => ({
            title: 'Measured labels',
            body: zlozView<EditorEvent>(h, editor, {
              id: 'measured',
              label: 'Measured labels',
              onEvent: (event) => event,
              labelMeasurement: enabled
                ? {
                    timeoutMs,
                    request: measurement.request,
                    onMeasured: () => ({ type: 'SelectionCleared' }),
                  }
                : undefined,
            }),
          }),
        },
        { flags: {}, isHydratable: false },
      ),
    )
  ).html;
}
test('SSR remains browser-effect free, measurement targets and probe are opt-in and keep label content', async () => {
  const ordinary = await render(false),
    measured = await render(true);
  expect(ordinary).not.toContain('data-zloz-label-measurement-scope');
  expect(ordinary).not.toContain('data-zloz-measured-label');
  expect(measured).toContain('data-zloz-label-measurement-scope=""');
  expect(measured).toContain('data-zloz-measured-label="ab"');
  expect(measured).toContain('A to B');
});

test('measurement deadlines are finite, positive and bounded before mounting', async () => {
  for (const timeout of [0, NaN, Infinity, 60001])
    await expect(render(true, timeout)).rejects.toThrow('timeout');
});
