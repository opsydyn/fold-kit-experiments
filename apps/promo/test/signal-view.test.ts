import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';

import { signalData } from '../src/examples/signals/data';
import { Inspection, type Model } from '../src/examples/signals/model';
import { view } from '../src/examples/signals/view';
import { init } from './signal-test-fixtures';
const render = async (model: Model) =>
  (
    await Effect.runPromise(
      renderToString(
        { Flags: Schema.Struct({ test: Schema.Boolean }), init: () => ({ model }), view },
        { flags: { test: true }, isHydratable: false },
      ),
    )
  ).html;
test('native view exposes three labelled charts raw records exact units and controlled source', async () => {
  const markup = await render(init({ data: signalData }).model);
  expect(markup.match(/<svg /g)).toHaveLength(3);
  expect(markup.match(/data-record-id=/g)).toHaveLength(120);
  for (const text of [
    'Latency overview',
    'Latency detail',
    'Error detail',
    'UTC',
    'Latency (ms)',
    'Errors (%)',
    'Range start',
    'Range end',
    'Zoom in',
    'Zoom out',
    'Reset view',
    'Clear selection',
    'Pin inspection',
    'Resume inspection',
    'Input unavailable',
    'Controlled state',
    'signal-119',
  ])
    expect(markup).toContain(text);
  expect(markup).toContain('data-signal-gesture');
  expect(markup).toMatch(/touch-action:\s*none/);
});
test('outside viewport pin keeps exact values and raw-row text without a fabricated cursor', async () => {
  const m = init({ data: signalData }).model;
  if (m._tag !== 'Ready') throw new RangeError('Expected Ready');
  const markup = await render({
    ...m,
    viewport: [m.bounds[0], m.bounds[0] + 1000],
    inspection: Inspection.Pinned({ key: 'signal-042' }),
  });
  expect(markup).toContain('outside current view');
  expect(markup).toContain('signal-042');
  expect(markup).toContain('Inspected');
  expect(markup.match(/class="signal-cursor"/g)).toBeNull();
  expect(markup).toContain('1700000001000');
});
test('empty invalid and singleton inputs remain visible without fabricated records', async () => {
  expect(await render(init({ data: [] }).model)).toContain('No observations');
  expect(
    await render(init({ data: [{ id: '', time: 0, latencyMs: 0, errorPercent: 0 }] }).model),
  ).toContain('Cannot display observations');
  const single = signalData.slice(0, 1);
  const markup = await render(init({ data: single }).model);
  expect(markup.match(/data-record-id=/g)).toHaveLength(1);
});

test('inspector and raw table preserve caller fractional percent precision', async () => {
  const model = init({
    data: [{ id: 'fractional', time: 1700000000000, latencyMs: 12.5, errorPercent: 0.125 }],
  }).model;
  if (model._tag !== 'Ready') throw new RangeError('Expected Ready');
  const markup = await render({
    ...model,
    inspection: Inspection.Following({ key: 'fractional' }),
  });
  expect(markup).toContain('<td>0.125</td>');
  expect(markup).toContain('<dd>0.125</dd>');
});
