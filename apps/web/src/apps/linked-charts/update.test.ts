import { Option } from 'effect';
import { describe, expect, it } from 'vitest';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { matchingKeys } from '../../ui/shared/inspection';
import { renderChart } from '../../ui/shared/render-chart.test-helper';
import { Message } from './message';
import { init } from './model';
import { update } from './update';
import { view } from './view';

const initialModel = () => init().model;

const scatterPointAndBin = () => {
  const model = initialModel();
  const pointIndex = 0;
  const point = Option.getOrThrow(Option.fromNullishOr(model.scatter.points[pointIndex]));

  const binIndex = model.histogram.bins.findIndex((bin) => point.y >= bin.x0 && point.y < bin.x1);
  Option.getOrThrow(Option.fromNullishOr(model.histogram.bins[binIndex]));

  return { binIndex, model, pointIndex };
};

const histogramBinAndPoint = () => {
  const model = initialModel();
  const binIndex = model.histogram.bins.findIndex((bin) => bin.count > 0);
  const bin = Option.getOrThrow(Option.fromNullishOr(model.histogram.bins[binIndex]));

  const pointIndex = model.scatter.points.findIndex(
    (point) => point.y >= bin.x0 && point.y < bin.x1,
  );
  Option.getOrThrow(Option.fromNullishOr(model.scatter.points[pointIndex]));

  return { binIndex, model, pointIndex };
};

describe('linked charts update', () => {
  it('highlights the corresponding histogram bin when a scatter point is hovered', () => {
    const { binIndex, model, pointIndex } = scatterPointAndBin();

    const nextModel = update(
      model,
      Message.ReceivedScatterMessage({
        message: Scatter.Message.HoveredPoint({ index: pointIndex }),
      }),
    ).model;

    expect(nextModel.scatter.activeIndex).toEqual(Option.some(pointIndex));
    expect(nextModel.histogram.activeBin).toEqual(Option.some(binIndex));
  });

  it('clears both active highlights when a scatter point is blurred', () => {
    const { model, pointIndex } = scatterPointAndBin();
    const hovered = update(
      model,
      Message.ReceivedScatterMessage({
        message: Scatter.Message.HoveredPoint({ index: pointIndex }),
      }),
    ).model;

    const nextModel = update(
      hovered,
      Message.ReceivedScatterMessage({ message: Scatter.Message.BlurredPoint() }),
    ).model;

    expect(nextModel.scatter.activeIndex).toEqual(Option.none());
    expect(nextModel.histogram.activeBin).toEqual(Option.none());
  });

  it('highlights every matching scatter key without moving local activeIndex', async () => {
    const model = {
      ...initialModel(),
      scatter: {
        ...initialModel().scatter,
        points: [
          { id: 'a', x: 1, y: 10, label: 'same' },
          { id: 'b', x: 2, y: 20, label: 'same' },
          { id: 'c', x: 2, y: 20, label: 'same' },
          { id: 'd', x: 3, y: 30, label: 'same' },
        ],
        activeIndex: Option.some(0),
      },
      histogram: {
        ...initialModel().histogram,
        bins: [
          { x0: 10, x1: 20, count: 1 },
          { x0: 20, x1: 30, count: 3 },
        ],
      },
    };
    const binIndex = 1;

    const nextModel = update(
      model,
      Message.ReceivedHistogramMessage({
        message: Histogram.Message.HoveredBin({ index: binIndex }),
      }),
    ).model;

    expect(nextModel.histogram.activeBin).toEqual(Option.some(binIndex));
    expect(nextModel.scatter.activeIndex).toEqual(Option.some(0));
    expect(nextModel.scatter).toBe(model.scatter);
    expect(nextModel.inspection).toEqual(
      Option.some({
        _tag: 'Range',
        lower: 20,
        upper: 30,
        includeEnd: true,
      }),
    );
    expect(matchingKeys(model.scatter.points, Option.getOrThrow(nextModel.inspection))).toEqual([
      'b',
      'c',
      'd',
    ]);
    const node = document.createElement('div');
    node.innerHTML = await renderChart<Message>((h) => view(nextModel, h).body);
    expect(
      Array.from(node.querySelectorAll('circle[data-linked-highlight="true"]')).map((mark) =>
        mark.getAttribute('aria-label'),
      ),
    ).toEqual(['same: (2, 20)', 'same: (2, 20)', 'same: (3, 30)']);
    expect(node.textContent).toContain('3 matching points');
    expect(node.textContent).toContain('same (1, 10)');
  });

  it('clears the range overlay without clearing the local scatter point', () => {
    const { binIndex, model } = histogramBinAndPoint();
    const active = { ...model, scatter: { ...model.scatter, activeIndex: Option.some(29) } };
    const hovered = update(
      active,
      Message.ReceivedHistogramMessage({
        message: Histogram.Message.HoveredBin({ index: binIndex }),
      }),
    ).model;

    const nextModel = update(
      hovered,
      Message.ReceivedHistogramMessage({ message: Histogram.Message.BlurredBin() }),
    ).model;

    expect(nextModel.histogram.activeBin).toEqual(Option.none());
    expect(nextModel.scatter).toBe(active.scatter);
    expect(nextModel.inspection).toEqual(Option.none());
  });

  it('renders a zero count for an empty range without selecting a fallback point', async () => {
    const model = initialModel();
    const result = update(
      {
        ...model,
        histogram: { ...model.histogram, bins: [{ x0: 0, x1: 1, count: 0 }] },
      },
      Message.ReceivedHistogramMessage({ message: Histogram.Message.HoveredBin({ index: 0 }) }),
    );
    expect(result.model.scatter).toBe(model.scatter);
    const node = document.createElement('div');
    node.innerHTML = await renderChart<Message>((h) => view(result.model, h).body);
    expect(node.querySelectorAll('circle[data-linked-highlight="true"]')).toHaveLength(0);
    expect(node.textContent).toContain('0 matching points');
  });
});

it('links keyboard inspection through semantic point events', () => {
  const model = initialModel();
  const result = update(
    model,
    Message.ReceivedScatterMessage({
      message: Scatter.Message.PressedKeyNav({ direction: 'next' }),
    }),
  );
  expect(result.model.scatter.activeIndex).toEqual(Option.some(0));
  expect(result.model.histogram.activeBin).toEqual(Option.some(0));
});

it('includes the final salary endpoint when linking a scatter inspection', () => {
  const model = initialModel();
  const pointIndex = model.scatter.points.length - 1;
  const result = update(
    model,
    Message.ReceivedScatterMessage({
      message: Scatter.Message.HoveredPoint({ index: pointIndex }),
    }),
  );
  expect(result.model.histogram.activeBin).toEqual(Option.some(model.histogram.bins.length - 1));
});

it('emits data-domain inspection facts from stateful chart children', () => {
  const model = initialModel();
  expect(
    Scatter.update(model.scatter, Scatter.Message.HoveredPoint({ index: 0 })).outMessage,
  ).toEqual({ _tag: 'InspectedPoint', key: 'salary-1', x: 1, y: 55000 });
  expect(Scatter.update(model.scatter, Scatter.Message.BlurredPoint()).outMessage).toEqual({
    _tag: 'ClearedInspection',
  });
  const bin = Option.getOrThrow(Option.fromNullishOr(model.histogram.bins[0]));
  expect(
    Histogram.update(model.histogram, Histogram.Message.HoveredBin({ index: 0 })).outMessage,
  ).toEqual({ _tag: 'InspectedRange', domain: [bin.x0, bin.x1], includeEnd: false });
});
