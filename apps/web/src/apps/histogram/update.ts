import type { Return as UpdateReturn } from 'foldkit/update';

import * as HistogramChart from '../../ui/histogram-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotHistogramMessage: ({ message }) => {
      const { model: chart } = HistogramChart.update(
        model.chart,
        message as HistogramChart.Message,
      );
      return { model: { ...model, chart } };
    },
  });
