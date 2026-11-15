import type { Return as UpdateReturn } from 'foldkit/update';

import * as PlotPanel from '../../ui/plot-panel';
import { linkedChartFolds } from './fold';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

const folds = linkedChartFolds({ scatter: PlotPanel.update, histogram: PlotPanel.update });

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedScatterMessage: ({ message }) => {
      // SAFETY: The parent message contract contains the scatter panel's Message.
      return folds.scatter(model, message as PlotPanel.Message);
    },
    ReceivedHistogramMessage: ({ message }) => {
      // SAFETY: The parent message contract contains the histogram panel's Message.
      return folds.histogram(model, message as PlotPanel.Message);
    },
  });
