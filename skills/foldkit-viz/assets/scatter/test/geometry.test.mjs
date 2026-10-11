import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGeometry, data } from '../dist/geometry.js';

test('preserves original data and keys while projecting finite coordinates', () => {
  const geometry = createGeometry(data);
  assert.equal(geometry.points.length, data.length);
  assert.equal(geometry.points[0].datum, data[0]);
  assert.deepEqual(
    geometry.points.map((point) => point.key),
    ['jan', 'feb', 'mar'],
  );
  assert.ok(geometry.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
});

test('resizing changes positions without changing datum identity', () => {
  const wide = createGeometry(data, 600);
  const narrow = createGeometry(data, 300);
  assert.notEqual(wide.points[2].x, narrow.points[2].x);
  assert.equal(wide.points[2].datum, narrow.points[2].datum);
});

test('empty and non-finite samples produce no invented points', () => {
  assert.equal(createGeometry([]).points.length, 0);
  assert.equal(createGeometry([{ ...data[0], value: NaN }]).points.length, 0);
});

test('duplicate record identity is rejected', () => {
  assert.throws(() => createGeometry([data[0], data[0]]), /Duplicate datum key/);
});
