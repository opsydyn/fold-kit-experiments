import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';

import { Message } from '../src/examples/signals/message';
import { init, type Model, type ReadyModel } from '../src/examples/signals/model';
import { Reading } from '../src/examples/signals/quality';
import { qualityProps } from '../src/examples/signals/quality-data';
import { update } from '../src/examples/signals/update';
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
  const m = init(structuredClone(qualityProps)).model;
  assert(m._tag === 'Ready', 'Expected Ready');
  return m;
};
const capture = (key = 'signal-035'): ReadyModel => {
  const m = update(
    { ...ready(), inspection: { _tag: 'Following', key } },
    Message.ClickedCaptureBaseline(),
  ).model;
  assert(m._tag === 'Ready', 'Expected Ready');
  return m;
};
const panel = (markup: string) => {
  const section = markup.match(/<section class="signal-comparison"[\s\S]*?<\/section>/)?.[0];
  assert(section, 'Expected comparison panel');
  return section;
};
const plot = (markup: string, role: string) => {
  const section = markup.match(
    new RegExp(`<section[^>]*class="signal-plot signal-plot-${role}"[^>]*>[\\s\\S]*?<\\/section>`),
  )?.[0];
  assert(section, 'Expected plot');
  return section;
};
test('no inspection disables capture and clear without inventing comparisons', async () => {
  const markup = await render(ready());
  expect(markup.match(/data-record-id=/g)).toHaveLength(115);
  const p = panel(markup);
  expect(p.match(/<button[^>]*>Capture baseline<\/button>/)?.[0]).toContain('disabled');
  expect(p.match(/<button[^>]*>Clear baseline<\/button>/)?.[0]).toContain('disabled');
  expect(p).toContain('No baseline captured');
  expect(markup).not.toContain('class="signal-comparison-error-bar"');
  const active = panel(
    await render({ ...ready(), inspection: { _tag: 'Following', key: 'signal-035' } }),
  );
  expect(active.match(/<button[^>]*>Capture baseline<\/button>/)?.[0]).not.toContain('disabled');
});
test('comparison panel retains exact capture provenance while current freshness and readings change', async () => {
  const base = { ...capture(), inspection: { _tag: 'Following' as const, key: 'signal-040' } };
  const stale = update(base, Message.ClickedFreshnessScenario({ scenario: 'Stale' })).model;
  const markup = await render(stale);
  const p = panel(markup);
  for (const text of [
    'Replace baseline',
    'signal-035',
    'signal-040',
    '2023-11-14T22:13:55.000Z',
    '2023-11-14T22:14:00.000Z',
    'Fresh at capture',
    'Current source: Stale',
    'signal-quality-v1',
    '2023-11-14T22:15:24.000Z',
    '2023-11-14T22:15:34.001Z',
    '2023-11-14T22:15:19.000Z',
    '10000 ms',
    '92 → 108 ms',
    'support: 0',
    'illustrative interpolation',
    '-100 ms',
    '-0.2 percentage points',
  ])
    expect(p).toContain(text);
  expect(p).toContain('aria-live="polite"');
  expect(p).not.toContain('relative');
  expect(markup.match(/data-record-id=/g)).toHaveLength(115);
});
test('unavailable comparisons reveal both diagnostics and never substitute another record', async () => {
  const missing = panel(
    await render({ ...capture(), inspection: { _tag: 'Pinned', key: 'signal-010' } }),
  );
  expect(missing).toContain('Comparison unavailable');
  expect(missing).toContain('collector unavailable');
  expect(missing).toContain('signal-010');
  const invalid = panel(
    await render({ ...capture(), inspection: { _tag: 'Pinned', key: 'signal-022' } }),
  );
  expect(invalid).toContain('Invalid (NaN)');
  expect(invalid).toContain('collector emitted non-finite value');
  expect(
    panel(await render({ ...capture(), inspection: { _tag: 'Following', key: null } })),
  ).toContain('No current inspection');
  const baselineInvalid = panel(
    await render({
      ...capture('signal-022'),
      inspection: { _tag: 'Following', key: 'signal-040' },
    }),
  );
  expect(baselineInvalid).toContain('Invalid (NaN)');
  expect(baselineInvalid).toContain('Comparison unavailable');
});
test('same-record bars deduplicate and explicit references differ from thresholds', async () => {
  const markup = await render(capture());
  for (const role of ['overview', 'latency', 'errors']) {
    const p = plot(markup, role);
    expect(p.match(/class="signal-comparison-error-bar"/g)).toHaveLength(1);
    expect(p).toContain('data-comparison-purpose="both"');
    expect(p).toContain('stroke-dasharray="3 3"');
  }
  const latency = plot(markup, 'latency');
  expect(latency).toContain('Comparison baseline: signal-035');
  expect(latency).toContain('100 ms');
  expect(latency).toContain('Estimated');
  expect(latency).toContain('Illustrative reference: Latency reference · 180 ms');
  expect(latency).toContain('signal-band');
  expect(latency).toContain('clip-path="url(#signal-quality-clip-latency)"');
  const p = panel(markup);
  expect(p).toContain('0 ms');
  expect(p).toContain('0 percentage points');
});
test('off-screen baseline keeps value reference and provenance without edge clamping', async () => {
  const m = {
    ...capture(),
    viewport: [1700000050000, 1700000060000] as const,
    inspection: { _tag: 'Pinned' as const, key: 'signal-010' },
  };
  const markup = await render(m);
  expect(panel(markup)).toContain('Outside current view');
  const latency = plot(markup, 'latency');
  expect(latency).toContain('class="signal-baseline-reference"');
  expect(latency).toContain('x1="-880"');
  expect(latency.match(/class="signal-comparison-error-bar"/g)).toHaveLength(1);
  expect(latency).toContain('Comparison baseline: signal-035');
  expect(plot(markup, 'overview')).toContain('class="signal-baseline-time"');
});
test('equal supplied intervals draw one cap and missing bounds draw no invented bar', async () => {
  const data = qualityProps.data.map((d) =>
    d.id === 'signal-035'
      ? {
          ...d,
          latency: Reading.Estimated({
            value: 100,
            bounds: { lower: 100, upper: 100, label: 'equal', support: 0 },
            method: 'provided',
          }),
        }
      : d,
  );
  const base = init({ ...qualityProps, data }).model;
  assert(base._tag === 'Ready', 'Expected Ready');
  const m = update(
    { ...base, inspection: { _tag: 'Following', key: 'signal-035' } },
    Message.ClickedCaptureBaseline(),
  ).model;
  const latency = plot(await render(m), 'latency');
  expect(latency.match(/class="signal-error-bar-cap"/g)).toHaveLength(1);
  const zero = await render(capture('signal-040'));
  expect(zero).not.toContain('class="signal-comparison-error-bar"');
  expect(plot(zero, 'latency')).toContain('class="signal-baseline-reference"');
});
test('baseline reference does not disguise a viewport with no drawable current measurements', async () => {
  const m = {
    ...capture(),
    viewport: [1700000070000, 1700000074000] as const,
    inspection: { _tag: 'Following' as const, key: null },
  };
  const markup = await render(m);
  expect(plot(markup, 'latency')).toContain('No drawable measurements in this view.');
  expect(plot(markup, 'latency')).toContain('class="signal-baseline-reference"');
  expect(panel(markup)).toContain('No current inspection');
});

const capCount = (markup: string): number =>
  (markup.match(/<line\b[^>]*>/g) ?? []).filter((line) => {
    const coordinate = (name: string) => Number(line.match(new RegExp(`${name}="([^"]+)"`))?.[1]);
    return coordinate('y1') === coordinate('y2') && coordinate('x2') - coordinate('x1') === 8;
  }).length;
for (const equal of [false, true])
  test(`singleton ${equal ? 'equal' : 'unequal'} interval has one rendering owner before and after capture`, async () => {
    const record = qualityProps.data.find((d) => d.id === 'signal-035');
    assert(record, 'Expected fixture record');
    const data = [
      {
        ...record,
        latency: Reading.Estimated({
          value: 100,
          bounds: {
            lower: equal ? 100 : 92,
            upper: equal ? 100 : 108,
            label: 'supplied',
            support: 0,
          },
          method: 'provided',
        }),
      },
    ];
    const initial = init({ ...qualityProps, data }).model;
    assert(initial._tag === 'Ready', 'Expected Ready');
    const unselected = plot(await render(initial), 'latency');
    expect(unselected).toContain('signal-interval-mark');
    expect(capCount(unselected)).toBe(equal ? 1 : 2);
    const selected: ReadyModel = { ...initial, inspection: { _tag: 'Following', key: record.id } };
    const captured = update(selected, Message.ClickedCaptureBaseline()).model;
    for (const model of [selected, captured]) {
      const latency = plot(await render(model), 'latency');
      expect(latency.match(/class="signal-comparison-error-bar"/g)).toHaveLength(1);
      expect(latency).not.toContain('signal-interval-mark');
      expect(capCount(latency)).toBe(equal ? 1 : 2);
      expect(latency).toContain('stroke-dasharray="' + (model === selected ? '7 4' : '3 3') + '"');
    }
  });

test('all-equal band retains only unselected fallback marks', async () => {
  const data = qualityProps.data
    .filter((d) => d.id === 'signal-034' || d.id === 'signal-035')
    .map((d) => ({
      ...d,
      latency: Reading.Estimated({
        value: 100,
        bounds: { lower: 100, upper: 100, label: 'equal', support: 0 },
        method: 'provided',
      }),
    }));
  const initial = init({ ...qualityProps, data }).model;
  assert(initial._tag === 'Ready', 'Expected Ready');
  const selected: ReadyModel = { ...initial, inspection: { _tag: 'Following', key: 'signal-035' } };
  const latency = plot(await render(selected), 'latency');
  expect(latency).toContain('Supplied interval for signal-034');
  expect(latency).not.toContain('Supplied interval for signal-035');
  expect(capCount(latency)).toBe(2);
  const captured = update(selected, Message.ClickedCaptureBaseline()).model;
  assert(captured._tag === 'Ready', 'Expected Ready');
  const compared = plot(
    await render({ ...captured, inspection: { _tag: 'Following', key: 'signal-034' } }),
    'latency',
  );
  expect(compared).not.toContain('signal-interval-mark');
  expect(compared.match(/class="signal-comparison-error-bar"/g)).toHaveLength(2);
  expect(capCount(compared)).toBe(2);
});
