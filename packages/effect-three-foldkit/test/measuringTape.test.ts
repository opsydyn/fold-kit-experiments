import { expect, test } from 'bun:test';

import { inertHtml } from 'foldkit/html';

import { MeasuringTape } from '../src/index.ts';

const start = MeasuringTape.init('tape');
const place = (model: MeasuringTape.Model, point: readonly [number, number, number]) =>
  MeasuringTape.update(model, MeasuringTape.Message.Placed({ point }));

test('the second end placed reports Measured with the length; the first and a third, nothing', () => {
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
});

test('pointing runs the tape to the pointer, and clearing empties it', () => {
  const first = place(start, [0, 0, 0]).model;
  const pointing = MeasuringTape.update(first, MeasuringTape.Message.Pointed({ point: [2, 0, 0] }));
  expect(MeasuringTape.length(pointing.model)).toMatchObject({ value: 2 });
  const cleared = MeasuringTape.update(pointing.model, MeasuringTape.Message.Cleared());
  expect(MeasuringTape.length(cleared.model)).toMatchObject({ _tag: 'None' });
});

test('snapping rounds the ends; the label shows the length at the middle, or nothing', () => {
  const snapping = MeasuringTape.update(
    start,
    MeasuringTape.Message.ChoseSnap({ snap: 0.25 }),
  ).model;
  const measured = place(place(snapping, [0.1, 0, 0]).model, [1.13, 0, 0]).model;
  // 0.1 rounds to 0 and 1.13 to 1.25.
  expect(MeasuringTape.length(measured)).toMatchObject({ value: 1.25 });
  const h = inertHtml;
  const [label] = MeasuringTape.label(measured, h, { unit: 'units' });
  expect(label?.overlay).toMatchObject({
    key: 'tape:label',
    position: [0.625, 0, 0],
    center: true,
  });
  expect(label?.pointerEvents).toBe('none');
  expect(MeasuringTape.label(start, h)).toEqual([]);
  expect(MeasuringTape.nodes(measured).key).toBe('tape');
});
