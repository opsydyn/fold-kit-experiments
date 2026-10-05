import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';

import { normaliseEventFeed } from '../src/examples/signals/events';
import { Message } from '../src/examples/signals/message';
import { init, type Model, type ReadyModel } from '../src/examples/signals/model';
import { qualityProps } from '../src/examples/signals/quality-data';
import { update } from '../src/examples/signals/update';
import { view } from '../src/examples/signals/view';
const t0 = 1700000000000;
const ready = (): ReadyModel => {
  const m = init(structuredClone(qualityProps)).model;
  assert(m._tag === 'Ready');
  return m;
};
const step = (m: ReadyModel, message: Message): ReadyModel => {
  const next = update(m, message).model;
  assert(next._tag === 'Ready');
  return next;
};
const render = async (model: Model): Promise<string> =>
  (
    await Effect.runPromise(
      renderToString(
        { Flags: Schema.Struct({ test: Schema.Boolean }), init: () => ({ model }), view },
        { flags: { test: true }, isHydratable: false },
      ),
    )
  ).html;
const panel = (markup: string): string => {
  const found = markup.match(/<section class="signal-events"[\s\S]*?<\/section>/)?.[0];
  assert(found, 'Events panel');
  return found;
};
const announcement = (markup: string): string => {
  const found = panel(markup).match(
    /<p[^>]*class="signal-event-announcement"[^>]*>([\s\S]*?)<\/p>/,
  )?.[1];
  assert(found !== undefined, 'Event announcement');
  return found;
};
test('event feed states and provenance distinguish omission, invalid, empty and no visible range', async () => {
  const m = ready();
  const empty = normaliseEventFeed({
    records: [],
    snapshot: { revision: 'empty-events', asOf: t0, updatedAt: t0, staleAfterMs: 0 },
  });
  expect(panel(await render({ ...m, events: { _tag: 'NotSupplied' } }))).toContain(
    'No event feed supplied',
  );
  expect(
    panel(await render({ ...m, events: { _tag: 'Invalid', error: 'Invalid independent feed' } })),
  ).toContain('Invalid independent feed');
  const p = panel(await render({ ...m, events: empty }));
  expect(p).toContain('No events recorded');
  expect(p).toContain('empty-events');
  const off = panel(await render({ ...m, viewport: [t0 + 20000, t0 + 30000] }));
  expect(off).toContain('No events in this time range');
  expect(off).toContain('0 in view / 8 recorded');
  expect(off).toContain('Browse events (8)');
  expect(off.match(/data-event-select=/g)).toHaveLength(8);
  expect(off).toContain('signal-events-v1');
  expect(off).toContain('2023-11-14T22:15:30.000Z');
  expect(off).toContain('2023-11-14T22:15:29.000Z');
  expect(off).toContain('10000 ms');
});
test('exact event evidence in gaps never borrows nearest observations or measurements', async () => {
  for (const key of ['event-note', 'event-gap']) {
    const m = step(ready(), Message.ClickedEvent({ key }));
    const p = panel(await render(m));
    expect(p).toContain('No observation at this exact timestamp');
    expect(m.inspection.key).toBeNull();
    expect(p).not.toContain('signal-069');
    expect(p).not.toContain('signal-075');
  }
  expect(
    panel(await render(step(ready(), Message.ClickedEvent({ key: 'event-boundary' })))),
  ).toContain('Exact observation: signal-119');
  const missing = await render(step(ready(), Message.ClickedEvent({ key: 'event-missing' })));
  expect(panel(missing)).toContain('Exact observation: signal-012');
  expect(missing).toContain('Missing — collector unavailable');
  const outside = panel(await render(step(ready(), Message.ClickedEvent({ key: 'event-before' }))));
  expect(outside).toContain('Outside available time range');
  expect(outside.match(/<button[^>]*>Centre event<\/button>/)?.[0]).toContain('disabled');
});
test('decorative grouping and selected guide retain distinct exact times with no SVG labels', async () => {
  const base = ready();
  const m = step(
    { ...base, widths: { ...base.widths, latency: 600 } },
    Message.ClickedEvent({ key: 'event-note' }),
  );
  const markup = await render(m),
    p = panel(markup);
  expect(p).toContain('3 events');
  expect(p).toContain('2023-11-14T22:14:08.200Z');
  expect(p).toContain('2023-11-14T22:14:08.000Z');
  expect(p.match(/<svg[\s\S]*?<\/svg>/)?.[0]).toContain('aria-hidden="true"');
  expect(p.match(/<svg[\s\S]*?<\/svg>/)?.[0]).not.toContain('<text');
  expect(p).toContain('aria-pressed="true"');
  expect(p).toContain('Selected event');
  expect(p).toContain('Description');
  expect(p).toContain('Source reference unspecified');
  expect(p.match(/<details[^>]*>/)?.[0]).not.toContain('open');
  expect(p.indexOf('signal-event-selected')).toBeLessThan(p.indexOf('<details'));
  expect(markup.match(/class="signal-event-guide"/g)).toHaveLength(3);
  expect(
    markup
      .match(/<line[^>]*class="signal-event-guide"[^>]*>/g)
      ?.every((line) => line.includes('stroke-dasharray="6 2 1 2"')),
  ).toBe(true);
  for (const role of ['overview', 'latency', 'errors']) {
    const plot = markup.match(
      new RegExp(
        `<section[^>]*class="signal-plot signal-plot-${role}"[^>]*>[\\s\\S]*?<\\/section>`,
      ),
    )?.[0];
    assert(plot);
    expect(plot).toMatch(
      new RegExp(
        `clip-path="url\\(#signal-quality-clip-${role}\\)"[\\s\\S]*?class="signal-event-guide"`,
      ),
    );
  }
});
test('selection announcement remains stable across pan hover resize and observation freshness', async () => {
  let m = step(ready(), Message.ClickedEvent({ key: 'event-gap' }));
  const original = announcement(await render(m));
  expect(original).toContain('event-gap');
  expect(original).toContain('2023-11-14T22:14:32.000Z');
  for (const action of [
    Message.RecordedPointerPosition({ role: 'latency', pointerId: 1, x: 200, y: 50 }),
    Message.ClickedZoomIn(),
    Message.RecordedChartWidth({ role: 'latency', width: 390 }),
    Message.ClickedFreshnessScenario({ scenario: 'Stale' }),
  ]) {
    m = step(m, action);
    expect(announcement(await render(m))).toBe(original);
  }
  const p = panel(await render(m));
  expect(p.match(/aria-live="polite"/g)).toHaveLength(1);
  expect(p).toContain('Event source: Fresh');
  const outside = await render({ ...m, viewport: [t0 + 20000, t0 + 30000] });
  expect(panel(outside)).toContain('Outside current view');
  expect(announcement(outside)).toBe(original);
  expect(announcement(await render(step(m, Message.ClickedClearEvent())))).toBe(
    'No event selected',
  );
});
test('escaped metadata and caller paints remain plain data with explicit unspecified fields', async () => {
  const base = ready();
  assert(base.events._tag === 'Ready');
  const record = base.events.records[0];
  assert(record);
  const events = normaliseEventFeed({
    records: [
      {
        ...record,
        label: '<script>chart</script>',
        description: null,
        sourceRef: 'https://example.test/?x=<b>',
        style: { stroke: 'var(--caller-paint)', fill: 'none', symbol: 'star' },
      },
    ],
    snapshot: base.events.snapshot,
  });
  const m = step({ ...base, events }, Message.ClickedEvent({ key: record.id }));
  const markup = await render(m),
    p = panel(markup);
  expect(p).not.toContain('<script>chart</script>');
  expect(p).toContain('&lt;script&gt;chart&lt;/script&gt;');
  expect(p).not.toMatch(/<a(?:\s|>)/);
  expect(p).toContain('Description unspecified');
  expect(markup).toContain('var(--caller-paint)');
});
test('existing signal composition retains quality, baseline evidence and complete raw table', async () => {
  let m: ReadyModel = { ...ready(), inspection: { _tag: 'Following', key: 'signal-035' } };
  m = step(m, Message.ClickedCaptureBaseline());
  m = step(m, Message.ClickedEvent({ key: 'event-deploy' }));
  m = { ...m, inspection: { _tag: 'Following', key: 'signal-040' } };
  const markup = await render(m);
  expect(markup.match(/data-record-id=/g)).toHaveLength(115);
  expect(markup).toContain('signal-comparison-error-bar');
  expect(markup).toContain('signal-band');
  expect(markup).toContain('Fresh at capture');
  expect(markup).toContain('signal-quality-v1');
  expect(markup.indexOf('class="signal-comparison"')).toBeLessThan(
    markup.indexOf('class="signal-events"'),
  );
  expect(markup.indexOf('class="signal-events"')).toBeLessThan(
    markup.indexOf('class="signal-plot signal-plot-latency"'),
  );
});
