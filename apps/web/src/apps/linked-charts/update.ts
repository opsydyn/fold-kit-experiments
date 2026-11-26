import { Option } from 'effect';
import { combine } from 'foldkit/update';
import type { Return as UpdateReturn } from 'foldkit/update';

import * as PlotPanel from '../../ui/plot-panel';
import { linkedChartFolds } from './fold';
import { Message } from './message';
import { pointsWithExperience, type Model } from './model';

type Return = UpdateReturn<Model, Message>;

const folds = linkedChartFolds({ scatter: PlotPanel.update, histogram: PlotPanel.update });

export const update = (model: Model, msg: Message): Return =>
  Message.match<Return>(msg, {
    ChangedMinimumExperience: ({ years }) => {
      if (!Number.isFinite(years) || years < 0) return { model };
      const replaced = PlotPanel.Message.ReplacedRows({ rows: pointsWithExperience(years) });
      return combine<Model, Message>(
        { ...model, minimumExperience: years, inspection: Option.none() },
        [
          (current) => folds.scatter(current, replaced),
          (current) => folds.histogram(current, replaced),
        ],
      );
    },
    ReceivedScatterMessage: ({ message }) => {
      // SAFETY: The parent message contract contains the scatter panel's Message.
      return folds.scatter(model, message as PlotPanel.Message);
    },
    ReceivedHistogramMessage: ({ message }) => {
      // SAFETY: The parent message contract contains the histogram panel's Message.
      return folds.histogram(model, message as PlotPanel.Message);
    },
  });
