import { expect, test } from 'bun:test';

import { histogramGeometry, changeBinCount, settingsSource } from '../src/examples/histogram/chart';
import { datasets } from '../src/examples/histogram/data';
import { init, update, Message } from '../src/examples/histogram/main';

test('exact bin boundaries retain both domain endpoints and put interior edges in the next bin', () => {
  const geometry = histogramGeometry([0, 19, 20, 39, 40, 59, 60, 79, 80, 100], 5);
  expect(geometry.bars.map(({ x0, x1, count }) => [x0, x1, count])).toEqual([
    [0, 20, 2],
    [20, 40, 2],
    [40, 60, 2],
    [60, 80, 2],
    [80, 100, 2],
  ]);
  expect(geometry.bars[0]).toMatchObject({ x: 48, y: 30, width: 95, height: 220 });
  expect(geometry.bars[4]).toMatchObject({ x: 432, y: 30, width: 95, height: 220 });
  expect(geometry.total).toBe(10);
});

test('changing bin count preserves all observations and finite bars, including empty bins', () => {
  const geometry = histogramGeometry([0, 100], 20);
  expect(geometry.bars).toHaveLength(20);
  expect(geometry.bars.map(({ count }) => count)).toEqual([
    1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
  ]);
  expect(geometry.total).toBe(2);
  expect(
    geometry.bars.every(({ x, y, width, height }) => [x, y, width, height].every(Number.isFinite)),
  ).toBe(true);
  expect(histogramGeometry([], 5).bars.every(({ height }) => height === 0)).toBe(true);
});

test('invalid bin counts cannot change the chart configuration', () => {
  const settings = { dataset: 'spread' as const, binCount: 5 };
  for (const raw of ['', 'NaN', 'Infinity', '1', '21', '2.5'])
    expect(changeBinCount(settings, raw)).toBe(settings);
  expect(changeBinCount(settings, '10')).toEqual({ dataset: 'spread', binCount: 10 });
});

test('dataset and bin controls drive geometry, source and reset from the same model', () => {
  let model = init({ sources: [], templateUrl: '/downloads/histogram-template.json' }).model;
  model = update(model, Message.SelectedDataset({ dataset: 'clustered' })).model;
  model = update(model, Message.ChangedBinCount({ value: '10' })).model;
  expect(model.settings).toEqual({ dataset: 'clustered', binCount: 10 });
  expect(histogramGeometry(datasets[model.settings.dataset], model.settings.binCount).total).toBe(
    40,
  );
  expect(settingsSource(model.settings)).toContain('"binCount": 10');
  const exporting = update(model, Message.ClickedDownload()).model;
  const reset = update(exporting, Message.ClickedReset()).model;
  expect(reset.settings).toEqual({ dataset: 'spread', binCount: 5 });
  expect(reset.actionStatus).toEqual({ _tag: 'Pending', action: 'download' });
  expect(update(reset, Message.ClickedCopy())).toEqual({ model: reset });
  const failed = update(reset, Message.FailedAction({ error: 'retry' })).model;
  expect(update(failed, Message.ClickedCopy()).commands?.length).toBe(1);
});
