import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { graphSurface, labelMeasurementProbe } from '../src/effect-ui';
import { createEditor, startLabelMeasurement } from '../src/index';
import { renderEffectUi } from './render-effect-ui';
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
    await renderEffectUi((h) =>
      h.div.attr('data-zloz-label-measurement-scope', enabled ? '' : undefined).children(
        graphSurface(h, state, {
          id: 'measured',
          label: 'Measured labels',
          onInput: ({ type }) => type,
          edgeEditing: {
            onEdit: ({ type }) => type,
            renderLabel: enabled
              ? ({ edge }, h) =>
                  h.span.attr('data-zloz-measured-label', edge.id).children(edge.label)
              : undefined,
          },
        }),
        enabled
          ? labelMeasurementProbe(h, measurement.request, ({ type }) => type, { timeoutMs })
          : null,
      ),
    )
  ).html;
}
test('SSR remains browser-effect free, measurement targets and probe are opt-in and keep label content', async () => {
  const ordinary = await render(false),
    measured = await render(true);
  expect(ordinary).not.toContain('data-zloz-label-measurement-scope');
  expect(ordinary).not.toContain('data-zloz-measured-label');
  expect(measured).toContain('data-zloz-label-measurement-scope');
  expect(measured).toContain('data-zloz-measured-label="ab"');
  expect(measured).toContain('A to B');
});

test('measurement deadlines are finite, positive and bounded before mounting', async () => {
  const measurement = startLabelMeasurement(state, 'ssr:1', 'badge:1');
  assert(measurement.type === 'pending');
  for (const timeoutMs of [0, NaN, Infinity, 60001]) {
    let failure: unknown;
    await renderEffectUi((h) => {
      // oxlint-disable-next-line linteffect/no-try-catch -- Capture the synchronous public guard before Effect UI handles view errors.
      try {
        return labelMeasurementProbe(h, measurement.request, ({ type }) => type, { timeoutMs });
      } catch (error) {
        failure = error;
        return h.div.children();
      }
    });
    expect(failure).toBeInstanceOf(Error);
    expect(failure instanceof Error && failure.message).toContain('timeout');
  }
});
