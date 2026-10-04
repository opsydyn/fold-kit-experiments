import { Option } from 'effect';
import { foldChild } from 'foldkit/update';
import type { Return, Step } from 'foldkit/update';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { Message } from './message';
import type { Model } from './model';

type ChartUpdaters = Readonly<{
  scatter: typeof Scatter.update;
  histogram: typeof Histogram.update;
}>;
type LinkedFolds = Readonly<{
  scatter: (model: Model, message: Scatter.Message) => Return<Model, Message>;
  histogram: (model: Model, message: Histogram.Message) => Return<Model, Message>;
}>;

function containsValue(value: number, lo: number, hi: number, includeEnd: boolean): boolean {
  const within = value >= lo && value < hi;
  const atEnd = includeEnd && value === hi;
  return within || atEnd;
}

/** The parent coordinates semantic events once; sibling notifications terminate here. */
export function linkedChartFolds(updaters: ChartUpdaters): LinkedFolds {
  const scatterOwner = {
    update: updaters.scatter,
    read: (model: Model) => Option.some(model.scatter),
    write: (model: Model, scatter: Scatter.Model) => ({ ...model, scatter }),
    toParentMessage: (message: Scatter.Message) => Message.ReceivedScatterMessage({ message }),
  };
  const histogramOwner = {
    update: updaters.histogram,
    read: (model: Model) => Option.some(model.histogram),
    write: (model: Model, histogram: Histogram.Model) => ({ ...model, histogram }),
    toParentMessage: (message: Histogram.Message) => Message.ReceivedHistogramMessage({ message }),
  };
  const consumeNotification = (): Step<Model, Message> => (model) => ({ model });
  const scatterSibling = foldChild({ ...scatterOwner, foldOutMessage: consumeNotification });
  const histogramSibling = foldChild({ ...histogramOwner, foldOutMessage: consumeNotification });

  const highlightHistogram =
    ({ y }: Extract<Scatter.OutMessage, { _tag: 'InspectedPoint' }>): Step<Model, Message> =>
    (model) => {
      const index = model.histogram.bins.findIndex((b, i) =>
        containsValue(y, b.x0, b.x1, i === model.histogram.bins.length - 1),
      );
      const message = Option.match(
        Option.filter(Option.some(index), (i) => i >= 0),
        {
          onNone: () => Histogram.Message.BlurredBin(),
          onSome: (index) => Histogram.Message.HoveredBin({ index }),
        },
      );
      return histogramSibling(model, message);
    };
  const highlightScatter =
    ({
      domain: [lo, hi],
    }: Extract<Histogram.OutMessage, { _tag: 'InspectedRange' }>): Step<Model, Message> =>
    (model) => {
      const final = model.histogram.bins.at(-1)?.x1 === hi;
      const index = model.scatter.points.findIndex((p) => containsValue(p.y, lo, hi, final));
      const message = Option.match(
        Option.filter(Option.some(index), (i) => i >= 0),
        {
          onNone: () => Scatter.Message.BlurredPoint(),
          onSome: (index) => Scatter.Message.HoveredPoint({ index }),
        },
      );
      return scatterSibling(model, message);
    };
  const foldScatterOutMessage = (event: Scatter.OutMessage): Step<Model, Message> =>
    Scatter.OutMessage.match(event, {
      InspectedPoint: highlightHistogram,
      ClearedInspection: () => histogramSibling(Histogram.Message.BlurredBin()),
    });
  const foldHistogramOutMessage = (event: Histogram.OutMessage): Step<Model, Message> =>
    Histogram.OutMessage.match(event, {
      InspectedRange: highlightScatter,
      ClearedInspection: () => scatterSibling(Scatter.Message.BlurredPoint()),
    });
  const scatter = foldChild({ ...scatterOwner, foldOutMessage: foldScatterOutMessage });
  const histogram = foldChild({ ...histogramOwner, foldOutMessage: foldHistogramOutMessage });
  return { scatter, histogram };
}
