import { Option } from 'effect';
import { foldChild } from 'foldkit/update';
import type { Return, Step } from 'foldkit/update';

import * as PlotPanel from '../../ui/plot-panel';
import { containsValue } from '../../ui/shared/inspection';
import { Message } from './message';
import type { Model } from './model';

type ChartUpdaters = Readonly<{
  scatter: typeof PlotPanel.update;
  histogram: typeof PlotPanel.update;
}>;

type LinkedFolds = Readonly<{
  scatter: (model: Model, message: PlotPanel.Message) => Return<Model, Message>;
  histogram: (model: Model, message: PlotPanel.Message) => Return<Model, Message>;
}>;

/** The histogram bar whose range holds a salary, by its position in x order. */
export const binHolding = (histogram: PlotPanel.Model, value: number): Option.Option<number> => {
  const index = PlotPanel.targetsOf(histogram).findIndex((bin) =>
    containsValue(value, bin.domain[0], bin.domain[1], bin.includeEnd),
  );
  return index < 0 ? Option.none() : Option.some(index);
};

/** The parent coordinates semantic events once; sibling notifications terminate here. */
export function linkedChartFolds(updaters: ChartUpdaters): LinkedFolds {
  const scatterOwner = {
    update: updaters.scatter,
    read: (model: Model) => Option.some(model.scatter),
    write: (model: Model, scatter: PlotPanel.Model) => ({ ...model, scatter }),
    toParentMessage: (message: PlotPanel.Message) => Message.ReceivedScatterMessage({ message }),
  };
  const histogramOwner = {
    update: updaters.histogram,
    read: (model: Model) => Option.some(model.histogram),
    write: (model: Model, histogram: PlotPanel.Model) => ({ ...model, histogram }),
    toParentMessage: (message: PlotPanel.Message) => Message.ReceivedHistogramMessage({ message }),
  };

  const consumeNotification = (): Step<Model, Message> => (model) => ({ model });
  const histogramSibling = foldChild({ ...histogramOwner, foldOutMessage: consumeNotification });

  const highlightHistogram =
    ({ key, y }: Extract<PlotPanel.OutMessage, { _tag: 'InspectedPoint' }>): Step<Model, Message> =>
    (model) =>
      histogramSibling(
        { ...model, inspection: Option.some({ _tag: 'Point', key }) },
        Option.match(binHolding(model.histogram, y), {
          onNone: () => PlotPanel.Message.BlurredTarget(),
          onSome: (index) => PlotPanel.Message.HoveredTarget({ index }),
        }),
      );

  const highlightScatter =
    ({
      domain: [lower, upper],
      includeEnd,
    }: Extract<PlotPanel.OutMessage, { _tag: 'InspectedRange' }>): Step<Model, Message> =>
    (model) => ({
      model: { ...model, inspection: Option.some({ _tag: 'Range', lower, upper, includeEnd }) },
    });

  const clearScatterInspection = (): Step<Model, Message> => (model) =>
    histogramSibling({ ...model, inspection: Option.none() }, PlotPanel.Message.BlurredTarget());
  const clearRangeInspection = (): Step<Model, Message> => (model) => ({
    model: { ...model, inspection: Option.none() },
  });

  const foldScatterOutMessage = (event: PlotPanel.OutMessage): Step<Model, Message> =>
    PlotPanel.OutMessage.match<Step<Model, Message>>(event, {
      InspectedPoint: highlightHistogram,
      InspectedRange: consumeNotification,
      ClearedInspection: clearScatterInspection,
      SelectedRange: consumeNotification,
      ClearedSelection: consumeNotification,
    });
  const foldHistogramOutMessage = (event: PlotPanel.OutMessage): Step<Model, Message> =>
    PlotPanel.OutMessage.match<Step<Model, Message>>(event, {
      InspectedPoint: consumeNotification,
      InspectedRange: highlightScatter,
      ClearedInspection: clearRangeInspection,
      SelectedRange: consumeNotification,
      ClearedSelection: consumeNotification,
    });

  const scatter = foldChild({ ...scatterOwner, foldOutMessage: foldScatterOutMessage });
  const histogram = foldChild({ ...histogramOwner, foldOutMessage: foldHistogramOutMessage });
  return { scatter, histogram };
}
