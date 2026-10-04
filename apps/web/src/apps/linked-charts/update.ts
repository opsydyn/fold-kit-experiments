import type { Return as UpdateReturn } from 'foldkit/update';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { linkedChartFolds } from './fold';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;
const folds = linkedChartFolds({ scatter: Scatter.update, histogram: Histogram.update });
export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedScatterMessage: ({ message }) => {
      // SAFETY: The parent message contract contains the scatter child's Message.
      return folds.scatter(model, message as Scatter.Message);
    },
    ReceivedHistogramMessage: ({ message }) => {
      // SAFETY: The parent message contract contains the histogram child's Message.
      return folds.histogram(model, message as Histogram.Message);
    },
  });
