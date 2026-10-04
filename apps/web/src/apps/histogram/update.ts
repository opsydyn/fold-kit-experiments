import type { Return as UpdateReturn } from 'foldkit/update';

import * as HistogramChart from '../../ui/histogram-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedHistogramMessage: ({ message }) => {
      const { model: chart } = HistogramChart.update(
        model.chart,
        // SAFETY: The app model and message contracts establish this value before the assertion.
        message as HistogramChart.Message,
      );
      return { model: { ...model, chart } };
    },
  });
