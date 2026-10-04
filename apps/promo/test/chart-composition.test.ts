import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { histogramGeometry } from '../src/examples/histogram/chart';
import * as Histogram from '../src/examples/histogram/main';
import { chartGeometry } from '../src/examples/line/chart';
import * as Line from '../src/examples/line/main';
import { scatterGeometry } from '../src/examples/scatter/chart';
import * as Scatter from '../src/examples/scatter/main';

const frame = { width: 324, height: 290, margins: { top: 30, right: 24, bottom: 60, left: 48 } };
async function render<M>(view: (h: HtmlBuilder<M>) => Document): Promise<string> {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({ test: Schema.Boolean }),
        init: () => ({ model: 0 }),
        view: (_model: number, h: HtmlBuilder<M>) => view(h),
      },
      { flags: { test: true }, isHydratable: false },
    ),
  );
  return result.html;
}

test('wrappers project unrelated custom data through caller frames and domains', () => {
  const line = chartGeometry(
    { values: [7], curve: 'linear', yMax: 10 },
    { frame, yDomain: [-10, 10] },
  );
  expect(line.points).toEqual([[174, 60]]);
  expect(line.path).not.toMatch(/NaN|Infinity/);
  const scatter = scatterGeometry(
    [{ id: 'custom', x: -5, y: -5, group: 'b' }],
    { group: 'all', xMax: 100, yMax: 100, selectedPoint: null },
    { frame, xDomain: [-10, 0], yDomain: [-10, 0] },
  );
  expect(scatter.points[0]).toMatchObject({ id: 'custom', cx: 174, cy: 130 });
  const histogram = histogramGeometry([-10, -5, 0], 2, { frame, domain: [-10, 0] });
  expect(histogram.bars.map((b) => b.count)).toEqual([1, 2]);
  expect(histogram.bars.map((b) => [b.x0, b.x1])).toEqual([
    [-10, -5],
    [-5, 0],
  ]);
});

test('width facts preserve scatter inspection and histogram configuration', () => {
  const scatter = Scatter.update(
    Scatter.init({ sources: [], templateUrl: null }).model,
    Scatter.Message.SelectedPoint({ id: 'b-03' }),
  ).model;
  const nextScatter = Scatter.update(
    scatter,
    Scatter.Message.RecordedChartWidth({ width: 324 }),
  ).model;
  expect(nextScatter.settings).toBe(scatter.settings);
  expect(nextScatter.settings.selectedPoint).toBe('b-03');
  const histogram = Histogram.update(
    Histogram.init({ sources: [], templateUrl: null }).model,
    Histogram.Message.ChangedBinCount({ value: '10' }),
  ).model;
  expect(
    Histogram.update(histogram, Histogram.Message.RecordedChartWidth({ width: 324 })).model
      .settings,
  ).toBe(histogram.settings);
});

test('reference views use measured frames and expose raw data alternatives', async () => {
  const line = Line.update(
    Line.init({ sources: [], templateUrl: null }).model,
    Line.Message.RecordedChartWidth({ width: 324 }),
  ).model;
  const lineHtml = await render<Line.Message>((h) => Line.view(line, h));
  expect(lineHtml).toContain('viewBox="0 0 324 290"');
  expect(lineHtml).toContain('font-size="12"');
  expect(lineHtml).toContain('Threshold 80');
  expect(lineHtml.match(/class="chart-line-series"/g)?.length).toBe(2);
  expect(lineHtml).toContain('Illustrative line values');
  const scatter = Scatter.update(
    Scatter.init({ sources: [], templateUrl: null }).model,
    Scatter.Message.RecordedChartWidth({ width: 324 }),
  ).model;
  const scatterHtml = await render<Scatter.Message>((h) => Scatter.view(scatter, h));
  expect(scatterHtml).toContain('viewBox="0 0 324 320"');
  expect(scatterHtml.match(/tabindex="0"/g)?.length).toBe(2); // chart navigation and source preview, not per-datum stops
  expect(scatterHtml).toContain('data-symbol="square"');
  expect(scatterHtml).toContain('Illustrative scatter values');
  const histogram = Histogram.update(
    Histogram.init({ sources: [], templateUrl: null }).model,
    Histogram.Message.RecordedChartWidth({ width: 324 }),
  ).model;
  const histogramHtml = await render<Histogram.Message>((h) => Histogram.view(histogram, h));
  expect(histogramHtml).toContain('viewBox="0 0 324 290"');
  expect(histogramHtml).toContain('Illustrative histogram values');
});

test('empty reference data shows visible feedback and accepted finite geometry', async () => {
  const model = Line.init({ sources: [], templateUrl: null }).model;
  const html = await render<Line.Message>((h) =>
    Line.view({ ...model, settings: { ...model.settings, values: [] } }, h),
  );
  expect(html).toContain('No values to display');
  expect(html).not.toMatch(/NaN|Infinity/);
});

test('scatter keyboard inspection uses the same selection fact as the point selector', () => {
  let model = Scatter.init({ sources: [], templateUrl: null }).model;
  model = Scatter.update(model, Scatter.Message.PressedChartKey({ key: 'ArrowRight' })).model;
  expect(model.settings.selectedPoint).toBe('a-01');
  model = Scatter.update(model, Scatter.Message.SelectedGroup({ group: 'b' })).model;
  model = Scatter.update(model, Scatter.Message.PressedChartKey({ key: 'Home' })).model;
  expect(model.settings.selectedPoint).toBe('b-01');
  expect(
    Scatter.update(model, Scatter.Message.PressedChartKey({ key: 'Escape' })).model.settings
      .selectedPoint,
  ).toBeNull();
});
