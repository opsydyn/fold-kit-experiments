import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';

import { MeasuringTape } from '../src/index.ts';

const start = MeasuringTape.init('tape');
const place = (model: MeasuringTape.Model, point: readonly [number, number, number]) =>
  MeasuringTape.update(model, MeasuringTape.Message.Placed({ point }));

function checkMeasurement() {
  const first = place(start, [0, 0, 0]);
  expect(first.outMessage).toBeUndefined();
  const second = place(first.model, [0, 3, 4]);
  expect(second.outMessage).toMatchObject({
    _tag: 'Measured',
    from: [0, 0, 0],
    to: [0, 3, 4],
    length: 5,
  });
  expect(place(second.model, [1, 1, 1]).outMessage).toBeUndefined();
}

function checkPointerAndClear() {
  const first = place(start, [0, 0, 0]).model;
  const pointing = MeasuringTape.update(first, MeasuringTape.Message.Pointed({ point: [2, 0, 0] }));
  expect(MeasuringTape.length(pointing.model)).toMatchObject({ value: 2 });
  const cleared = MeasuringTape.update(pointing.model, MeasuringTape.Message.Cleared());
  expect(MeasuringTape.length(cleared.model)).toMatchObject({ _tag: 'None' });
}

async function checkSnappedLabel() {
  const snapping = MeasuringTape.update(
    start,
    MeasuringTape.Message.ChoseSnap({ snap: 0.25 }),
  ).model;
  const measured = place(place(snapping, [0.1, 0, 0]).model, [1.13, 0, 0]).model;
  // 0.1 rounds to 0 and 1.13 to 1.25.
  expect(MeasuringTape.length(measured)).toMatchObject({ value: 1.25 });
  const TapeLabel = Html.component({
    name: 'TapeFixture',
    model: Schema.Null,
    message: Schema.Never,
  }).make({
    init: () => null,
    update: () => null,
    view: function labelView(h) {
      const [label] = MeasuringTape.label(measured, h, { unit: 'units' });
      expect(label?.overlay).toMatchObject({
        key: 'tape:label',
        position: [0.625, 0, 0],
        center: true,
      });
      expect(label?.pointerEvents).toBe('none');
      expect(MeasuringTape.label(start, h)).toEqual([]);
      return h.div.children(label?.content ?? null);
    },
  });
  const { html } = await Effect.runPromise(
    HtmlServer.renderToHtml(TapeLabel, {}, { static: true }),
  );
  expect(html).toContain('<div><span>1.25 units</span></div>');
  expect(MeasuringTape.nodes(measured).key).toBe('tape');
}

test(
  'the second end placed reports Measured with the length; the first and a third, nothing',
  checkMeasurement,
);
test('pointing runs the tape to the pointer, and clearing empties it', checkPointerAndClear);
test(
  'snapping rounds the ends; the label shows the length at the middle, or nothing',
  checkSnappedLabel,
);
