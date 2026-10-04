import { expect, test } from 'bun:test';

import {
  scatterGeometry,
  changeDomain,
  changeGroup,
  selectPoint,
} from '../src/examples/scatter/chart';
import { points } from '../src/examples/scatter/data';
import { init, update, Message } from '../src/examples/scatter/main';
import { currentSource } from '../src/examples/scatter/update';

const settings = { group: 'all' as const, xMax: 100, yMax: 100, selectedPoint: null };

test('domains map known values to plot coordinates and changing domains rescales points', () => {
  const sample = [
    { id: 'origin', group: 'a' as const, x: 0, y: 0 },
    { id: 'middle', group: 'a' as const, x: 50, y: 50 },
    { id: 'end', group: 'b' as const, x: 100, y: 100 },
  ];
  scatterGeometry(sample, settings).points.forEach(({ cx, cy }, index) => {
    expect(cx).toBeCloseTo([48, 288, 528][index] ?? NaN, 10);
    expect(cy).toBeCloseTo([250, 140, 30][index] ?? NaN, 10);
  });
  expect(scatterGeometry(sample, { ...settings, xMax: 200, yMax: 200 }).points[2]).toMatchObject({
    cx: 288,
    cy: 140,
  });
  expect(scatterGeometry(points, settings).points).toHaveLength(24);
  expect(scatterGeometry(points, { ...settings, group: 'b' }).points).toHaveLength(12);
});

test('point selection cannot retain a hidden or unknown point', () => {
  const selected = selectPoint(settings, 'a-01');
  expect(selected.selectedPoint).toBe('a-01');
  expect(changeGroup(selected, 'b').selectedPoint).toBeNull();
  expect(changeGroup(selected, 'all').selectedPoint).toBe('a-01');
  expect(selectPoint(settings, 'missing')).toBe(settings);
  expect(selectPoint({ ...settings, group: 'b' }, 'a-01').selectedPoint).toBeNull();
  expect(selectPoint(selected, '').selectedPoint).toBeNull();
});

test('domain inputs accept only the advertised integer steps', () => {
  for (const value of ['', 'NaN', 'Infinity', '99', '201', '150.5', '155'])
    expect(changeDomain(settings, 'xMax', value)).toBe(settings);
  expect(changeDomain(settings, 'yMax', '150')).toEqual({ ...settings, yMax: 150 });
});

test('inspection and controls share the source and keep export actions pending through edits', () => {
  let model = init({ sources: [], templateUrl: '/downloads/scatter-template.json' }).model;
  model = update(model, Message.SelectedPoint({ id: 'b-03' })).model;
  model = update(model, Message.ChangedDomain({ axis: 'xMax', value: '150' })).model;
  expect(currentSource(model)).toContain('"selectedPoint": "b-03"');
  expect(currentSource(model)).toContain('"xMax": 150');
  const exporting = update(model, Message.ClickedDownload()).model;
  const filtered = update(exporting, Message.SelectedGroup({ group: 'a' })).model;
  expect(filtered.settings.selectedPoint).toBeNull();
  const reset = update(filtered, Message.ClickedReset()).model;
  expect(reset.settings).toEqual(settings);
  expect(reset.actionStatus).toEqual({ _tag: 'Pending', action: 'download' });
  expect(update(reset, Message.ClickedCopy())).toEqual({ model: reset });
  const failed = update(reset, Message.FailedAction({ error: 'retry' })).model;
  expect(update(failed, Message.ClickedCopy()).commands?.length).toBe(1);
});
