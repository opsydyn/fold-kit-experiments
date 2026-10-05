import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';

import { init, type Model, type ReadyModel } from '../src/examples/signals/model';
import { Reading } from '../src/examples/signals/quality';
import { qualityProps } from '../src/examples/signals/quality-data';
import { view } from '../src/examples/signals/view';
const render = async (model: Model) =>
  (
    await Effect.runPromise(
      renderToString(
        { Flags: Schema.Struct({ test: Schema.Boolean }), init: () => ({ model }), view },
        { flags: { test: true }, isHydratable: false },
      ),
    )
  ).html;
const ready = (): ReadyModel => {
  const m = init(qualityProps).model;
  assert(m._tag === 'Ready', 'Expected a Ready fixture');
  return m;
};
test('quality view exposes real records legend source and caller reference meaning', async () => {
  const markup = await render(ready());
  expect(markup.match(/data-record-id=/g)).toHaveLength(115);
  for (const text of [
    'caller-supplied interval',
    'collector unavailable',
    'collector emitted non-finite value',
    'illustrative interpolation',
    'Fresh snapshot',
    'Stale snapshot',
    'signal-quality-v1',
    'Illustrative reference: Latency reference · 180 ms',
    'Illustrative reference: Error reference · 2 %',
    'Missing',
    'Invalid',
    'Gap',
    'Estimated',
  ])
    expect(markup).toContain(text);
  expect(markup).toContain('signal-band');
  expect(markup).toContain('fill="var(--surface)"');
  expect(markup).not.toContain('var(--bg)');
  expect(markup).toContain('clip-path');
  expect(markup).toContain('signal-quality-lane');
});
test('inspected estimate retains exact endpoints support zero and source freshness', async () => {
  const m = { ...ready(), inspection: { _tag: 'Pinned' as const, key: 'signal-035' } };
  let markup = await render(m);
  for (const text of [
    'support: 0',
    'Illustrative supplied range',
    '2023-11-14T22:13:55.000Z',
    '2023-11-14T22:15:24.000Z',
    '2023-11-14T22:15:19.000Z',
    '10000 ms',
    'Source: Fresh',
  ])
    expect(markup).toContain(text);
  markup = await render({ ...m, snapshot: { ...m.snapshot, asOf: 1700000134001 } });
  expect(markup).toContain('Source: Stale');
  expect(markup).toContain('Pinned signal-035');
});
test('missing and invalid inspection never draws a fabricated value or outside-view cursor', async () => {
  let m = { ...ready(), inspection: { _tag: 'Pinned' as const, key: 'signal-010' } };
  let markup = await render(m);
  expect(markup.match(/class="signal-cursor"/g)).toHaveLength(3);
  expect(markup).toContain('Missing — collector unavailable');
  markup = await render({ ...m, viewport: [1700000040000, 1700000050000] });
  expect(markup).toContain('outside current view');
  expect(markup).not.toContain('class="signal-cursor"');
});
test('all-invalid view supplies honest empty metric text and equal singleton interval', async () => {
  const base = qualityProps.data[0];
  assert(base, 'Expected the first fixture record');
  const m = init({
    ...qualityProps,
    data: [
      {
        ...base,
        latency: Reading.Missing({ reason: 'offline' }),
        errors: Reading.Invalid({ raw: 'NaN', reason: 'broken' }),
      },
    ],
    thresholds: [],
  }).model;
  const markup = await render(m);
  expect(markup.match(/No drawable measurements/g)).toHaveLength(3);
  expect(markup).not.toContain('class="signal-band"');
  const single = init({
    ...qualityProps,
    data: [
      {
        ...base,
        latency: Reading.Observed({
          value: 0,
          bounds: { lower: 0, upper: 0, label: 'Equal supplied range', support: null },
        }),
      },
    ],
    thresholds: [],
  }).model;
  expect(await render(single)).toContain('signal-interval-mark');
  expect(await render(single)).toContain('support: unspecified');
});
test('threshold identities survive shared locations and long labels', async () => {
  const m = ready();
  const markup = await render({
    ...m,
    thresholds: [
      {
        id: 'one',
        metric: 'latency',
        value: 180,
        label: 'Long first reference label for a narrow screen',
        style: {},
      },
      {
        id: 'two',
        metric: 'latency',
        value: 180,
        label: 'Long second reference label for a narrow screen',
        style: { stroke: 'var(--chart-series-b)' },
      },
    ],
  });
  expect(markup).toContain('signal-reference-list');
  for (const id of ['one', 'two'])
    expect(markup.match(new RegExp(`data-threshold-id="${id}"`, 'g'))).toHaveLength(4);
  expect(markup).toContain(
    'Illustrative reference: Long first reference label for a narrow screen · 180 ms',
  );
});

test('inspector itself discloses source freshness identity and snapshot times', async () => {
  const m = { ...ready(), inspection: { _tag: 'Pinned' as const, key: 'signal-035' } };
  const inspector = (markup: string) =>
    markup.split('class="signal-inspector"')[1]?.split('</section>')[0] ?? '';
  const fresh = inspector(await render(m));
  const stale = inspector(await render({ ...m, snapshot: { ...m.snapshot, asOf: 1700000134001 } }));
  for (const text of [
    'Source: Fresh',
    'signal-quality-v1',
    '2023-11-14T22:15:24.000Z',
    '2023-11-14T22:15:19.000Z',
    '10000 ms',
  ])
    expect(fresh).toContain(text);
  expect(stale).toContain('Source: Stale');
  expect(stale).toContain('2023-11-14T22:15:34.001Z');
  expect(stale).not.toBe(fresh);
});

test('quality lane labels remain vertically separate from the time-axis title', async () => {
  const markup = await render(ready());
  for (const svg of markup.match(/<svg\b[\s\S]*?<\/svg>/g) ?? []) {
    const texts = [...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map((match) => ({
      label: match[2],
      y: Number(match[1]?.match(/\by="([^"]+)"/)?.[1]),
    }));
    const title = texts.find((text) => text.label === 'Time (UTC)');
    expect(title).toBeDefined();
    for (const label of texts.filter((text) => ['M', '!', 'G'].includes(text.label ?? '')))
      expect(Math.abs(label.y - (title?.y ?? NaN))).toBeGreaterThanOrEqual(14);
  }
});
