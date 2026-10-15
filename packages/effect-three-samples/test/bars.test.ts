import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { valuesFor } from '../src/bars/data';
import { barKey, barOf, layoutFor, orderedMonths, plot } from '../src/bars/layout';
import { Message } from '../src/bars/message';
import { init, type Model, months, seriesList } from '../src/bars/model';
import { update } from '../src/bars/update';

const initial = init().model;
const step = (model: Model, message: Message): Model => update(model, message).model;

describe('bar chart layout', () => {
  test('every bar stands on the floor, and the tallest shown bar fits the plot', () => {
    for (const seed of [1, 2, 3, 40]) {
      const layout = layoutFor(initial, valuesFor(seed));
      for (const bar of layout.bars) {
        expect(bar.position[1] - bar.scale[1] / 2).toBeCloseTo(0, 12);
        expect(bar.scale[1]).toBeLessThanOrEqual(plot.height + 1e-9);
      }
      expect(layout.gridlines.every((line) => line.value % layout.step === 0)).toBe(true);
    }
  });

  test('hidden series lie flat and stop being interactive', () => {
    const model = step(initial, Message.ClickedSeries({ series: 'search' }));
    const layout = layoutFor(model, valuesFor(model.seed));
    for (const bar of layout.bars) {
      expect(bar.shown).toBe(bar.bar.series !== 'search');
      if (!bar.shown) expect(bar.scale[1]).toBeLessThan(0.01);
    }
  });

  test('keys round-trip, and unknown keys are not bars', () => {
    for (const month of months) {
      for (const series of seriesList) {
        expect(barOf(barKey({ month, series }))).toEqual({ month, series });
      }
    }
    expect(barOf('grid:20')).toBeUndefined();
    expect(barOf('bar:Dec:search')).toBeUndefined();
  });

  test('sorting by total orders months by their shown total, largest first', () => {
    const model = step(initial, Message.ClickedOrder());
    const values = valuesFor(model.seed);
    const totals = orderedMonths(model, values).map((month) =>
      seriesList.reduce((sum, series) => sum + values[month][series], 0),
    );
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
  });
});

describe('bar chart update', () => {
  test('the legend never hides the last series shown', () => {
    const one = step(
      step(initial, Message.ClickedSeries({ series: 'search' })),
      Message.ClickedSeries({ series: 'social' }),
    );
    expect(one.hidden).toEqual(['search', 'social']);
    expect(step(one, Message.ClickedSeries({ series: 'direct' }))).toBe(one);
  });

  test('double-clicking a bar isolates its series, and again restores all', () => {
    const key = barKey({ month: 'Mar', series: 'social' });
    const isolated = step(initial, Message.DoubleClickedBar({ key }));
    expect(isolated.hidden).toEqual(['search', 'direct']);
    expect(step(isolated, Message.DoubleClickedBar({ key })).hidden).toEqual([]);
  });

  test('a click pins a bar, a second click or a miss unpins it, and hiding drops the pin', () => {
    const key = barKey({ month: 'Feb', series: 'direct' });
    const pinned = step(initial, Message.ClickedBar({ key }));
    expect(pinned.selected).toEqual(Option.some({ month: 'Feb', series: 'direct' }));
    expect(Option.isNone(step(pinned, Message.ClickedBar({ key })).selected)).toBe(true);
    expect(Option.isNone(step(pinned, Message.ClickedEmptySpace()).selected)).toBe(true);
    const hidden = step(pinned, Message.ClickedSeries({ series: 'direct' }));
    expect(Option.isNone(hidden.selected)).toBe(true);
  });
});
