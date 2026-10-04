import { Option } from 'effect';
import { describe, expect, it } from 'vitest';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { Message } from './message';
import { init } from './model';
import { update } from './update';

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

  it('highlights the first scatter point in a hovered histogram bin', () => {
    const { binIndex, model, pointIndex } = histogramBinAndPoint();

    const nextModel = update(
      model,
      Message.ReceivedHistogramMessage({
        message: Histogram.Message.HoveredBin({ index: binIndex }),
      }),
    ).model;

    expect(nextModel.histogram.activeBin).toEqual(Option.some(binIndex));
    expect(nextModel.scatter.activeIndex).toEqual(Option.some(pointIndex));
  });

  it('clears both active highlights when a histogram bin is blurred', () => {
    const { binIndex, model } = histogramBinAndPoint();
    const hovered = update(
      model,
      Message.ReceivedHistogramMessage({
        message: Histogram.Message.HoveredBin({ index: binIndex }),
      }),
    ).model;

    const nextModel = update(
      hovered,
      Message.ReceivedHistogramMessage({ message: Histogram.Message.BlurredBin() }),
    ).model;

    expect(nextModel.histogram.activeBin).toEqual(Option.none());
    expect(nextModel.scatter.activeIndex).toEqual(Option.none());
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
  ).toEqual({ _tag: 'InspectedPoint', key: '1yr', x: 1, y: 55000 });
  expect(Scatter.update(model.scatter, Scatter.Message.BlurredPoint()).outMessage).toEqual({
    _tag: 'ClearedInspection',
  });
  const bin = Option.getOrThrow(Option.fromNullishOr(model.histogram.bins[0]));
  expect(
    Histogram.update(model.histogram, Histogram.Message.HoveredBin({ index: 0 })).outMessage,
  ).toEqual({ _tag: 'InspectedRange', domain: [bin.x0, bin.x1] });
});
